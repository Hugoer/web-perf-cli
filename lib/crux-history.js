const fs = require('fs');

const { buildRequestBody, callCruxApi, CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS } = require('./crux');
const { ensureCommandDir, buildFilename, normalizeOrigin, withRetry, runBatch } = require('./utils');

const CRUX_HISTORY_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';
const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND = 2.5;

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {import('./crux').CruxFormFactor} CruxFormFactor
 *
 * @typedef {chromeuxreport_v1.Schema$HistoryRecord & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   formFactor: CruxFormFactor|null,
 *   url: string,
 *   extractedAt: string
 * }} CruxHistoryReport
 *
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxHistoryReport|null, error: string|null }} CruxHistoryBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, error: string|null }} CruxHistoryBatchWriteResult
 */

/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactor?: CruxFormFactor }} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
async function runCruxHistoryAudit(rawUrl, apiKey, { scope = 'page', formFactor } = {}) {
    const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
    const body = buildRequestBody(url, scope, formFactor);
    const data = await callCruxApi(CRUX_HISTORY_API_URL, body, apiKey, { scope, dataLabel: 'CrUX history' });

    return {
        source: 'crux-api',
        scope,
        formFactor: formFactor || null,
        url,
        collectionPeriods: data.record.collectionPeriods,
        extractedAt: new Date().toISOString(),
        metrics: data.record.metrics,
        key: data.record.key,
    };
}

/**
 * Runs CrUX History audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactors?: CruxFormFactor[], onNoData?: (formFactor: CruxFormFactor, message: string) => void }} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
async function runCruxHistory(rawUrl, apiKey, { scope = 'page', formFactors = DEFAULT_CRUX_FORM_FACTORS, onNoData } = {}) {
    ensureCommandDir('crux-history');
    const paths = [];
    for (const formFactor of formFactors) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const output = await runCruxHistoryAudit(rawUrl, apiKey, { scope, formFactor });
            const outputPath = buildFilename(output.url, 'crux-history', formFactor);
            fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
            paths.push(outputPath);
        } catch (err) {
            if (err.statusCode === 404) {
                if (onNoData) {
                    onNoData(formFactor, err.message);
                }
            } else {
                throw err;
            }
        }
    }
    return paths;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
async function runCruxHistoryAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
    const items = urls.flatMap((url) => formFactors.map((formFactor) => ({ url, formFactor })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runCruxHistoryAudit(item.url, apiKey, { scope, formFactor: item.formFactor }),
            { label: `${item.url} [${item.formFactor}]` },
        ),
        {
            maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            urlOf: (item) => item.url,
        },
    );
    return results.map((r) => ({
        url: r.item.url,
        formFactor: r.item.formFactor,
        data: r.data ?? null,
        error: r.error,
    }));
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchWriteResult[]>}
 */
async function runCruxHistoryBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
    ensureCommandDir('crux-history');
    const items = urls.flatMap((url) => formFactors.map((formFactor) => ({ url, formFactor })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runCruxHistoryAudit(item.url, apiKey, { scope, formFactor: item.formFactor }),
            { label: `${item.url} [${item.formFactor}]` },
        ),
        {
            maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            urlOf: (item) => item.url,
            writeFn: (item, data) => {
                const outputPath = buildFilename(data.url, 'crux-history', item.formFactor);
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
                return outputPath;
            },
        },
    );
    return results.map((r) => ({
        url: r.item.url,
        formFactor: r.item.formFactor,
        outputPath: r.outputPath ?? null,
        error: r.error,
    }));
}

module.exports = {
    runCruxHistory,
    runCruxHistoryBatch,
    runCruxHistoryAudit,
    runCruxHistoryAuditBatch,
    CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
    CRUX_FORM_FACTORS,
    DEFAULT_CRUX_FORM_FACTORS,
};
