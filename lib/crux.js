const fs = require('fs');

const { ensureCommandDir, buildFilename, normalizeOrigin, withRetry, runBatch } = require('./utils');

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const CRUX_MAX_REQUESTS_PER_SECOND = 2.5;
const CRUX_FORM_FACTORS = /** @type {const} */ (['phone', 'desktop', 'tablet']);
const DEFAULT_CRUX_FORM_FACTORS = ['phone', 'desktop'];

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {'phone'|'desktop'|'tablet'} CruxFormFactor
 *
 * @typedef {chromeuxreport_v1.Schema$Record & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   formFactor: CruxFormFactor|null,
 *   url: string,
 *   extractedAt: string
 * }} CruxReport
 *
 * @typedef {{ url: string, formFactor: CruxFormFactor }} CruxWorkItem
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxReport|null, error: string|null }} CruxBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, error: string|null }} CruxBatchWriteResult
 */

/**
 * @param {string} url
 * @param {'origin'|'page'} scope
 * @param {CruxFormFactor} [formFactor]
 */
function buildRequestBody(url, scope, formFactor) {
    const body = scope === 'origin' ? { origin: normalizeOrigin(url) } : { url };
    if (formFactor) {
        body.formFactor = formFactor.toUpperCase();
    }
    return body;
}

async function callCruxApi(endpointUrl, body, apiKey, { scope = 'page', dataLabel = 'CrUX' } = {}) {
    const url = body.origin || body.url;
    const response = await fetch(`${endpointUrl}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const responseBody = await response.text();
        if (response.status === 404) {
            const target = scope === 'origin' ? `origin "${url}"` : `page "${url}"`;
            const err = new Error(
                `No ${dataLabel} data found for ${target}. Pages need ~300+ monthly visits to have data.`
            );
            err.statusCode = response.status;
            throw err;
        }
        const err = new Error(`${dataLabel} API error (${response.status}): ${responseBody}`);
        err.statusCode = response.status;
        throw err;
    }

    return response.json();
}

/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactor?: CruxFormFactor }} [options]
 * @returns {Promise<CruxReport>}
 */
async function runCruxAudit(rawUrl, apiKey, { scope = 'page', formFactor } = {}) {
    const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
    const body = buildRequestBody(url, scope, formFactor);
    const data = await callCruxApi(CRUX_API_URL, body, apiKey, { scope, dataLabel: 'CrUX' });

    return {
        source: 'crux-api',
        scope,
        formFactor: formFactor || null,
        url,
        collectionPeriod: data.record.collectionPeriod,
        extractedAt: new Date().toISOString(),
        metrics: data.record.metrics,
        key: data.record.key,
    };
}

/**
 * Runs CrUX audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactors?: CruxFormFactor[], onNoData?: (formFactor: CruxFormFactor, message: string) => void }} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
async function runCrux(rawUrl, apiKey, { scope = 'page', formFactors = DEFAULT_CRUX_FORM_FACTORS, onNoData } = {}) {
    ensureCommandDir('crux');
    const paths = [];
    for (const formFactor of formFactors) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const output = await runCruxAudit(rawUrl, apiKey, { scope, formFactor });
            const outputPath = buildFilename(output.url, 'crux', formFactor);
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
 * @returns {Promise<CruxBatchResult[]>}
 */
async function runCruxAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
    const items = urls.flatMap((url) => formFactors.map((formFactor) => ({ url, formFactor })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runCruxAudit(item.url, apiKey, { scope, formFactor: item.formFactor }),
            { label: `${item.url} [${item.formFactor}]` },
        ),
        {
            maxRequestsPerSecond: CRUX_MAX_REQUESTS_PER_SECOND,
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
 * @returns {Promise<CruxBatchWriteResult[]>}
 */
async function runCruxBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
    ensureCommandDir('crux');
    const items = urls.flatMap((url) => formFactors.map((formFactor) => ({ url, formFactor })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runCruxAudit(item.url, apiKey, { scope, formFactor: item.formFactor }),
            { label: `${item.url} [${item.formFactor}]` },
        ),
        {
            maxRequestsPerSecond: CRUX_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            urlOf: (item) => item.url,
            writeFn: (item, data) => {
                const outputPath = buildFilename(data.url, 'crux', item.formFactor);
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
    buildRequestBody,
    callCruxApi,
    runCrux,
    runCruxBatch,
    runCruxAudit,
    runCruxAuditBatch,
    CRUX_MAX_REQUESTS_PER_SECOND,
    CRUX_FORM_FACTORS,
    DEFAULT_CRUX_FORM_FACTORS,
};
