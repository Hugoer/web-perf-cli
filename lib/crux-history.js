const fs = require('fs');

const { buildRequestBody, callCruxApi } = require('./crux');
const { ensureCommandDir, buildFilename, normalizeOrigin, withRetry, runBatch } = require('./utils');

const CRUX_HISTORY_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';
const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND = 2.5;

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {chromeuxreport_v1.Schema$HistoryRecord & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   url: string,
 *   extractedAt: string
 * }} CruxHistoryReport
 *
 * @typedef {{ url: string, data: CruxHistoryReport|null, error: string|null }} CruxHistoryBatchResult
 */

/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page' }} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
async function runCruxHistoryAudit(rawUrl, apiKey, { scope = 'page' } = {}) {
    const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
    const body = buildRequestBody(url, scope);
    const data = await callCruxApi(CRUX_HISTORY_API_URL, body, apiKey, { scope, dataLabel: 'CrUX history' });

    return {
        source: 'crux-api',
        scope,
        url,
        collectionPeriods: data.record.collectionPeriods,
        extractedAt: new Date().toISOString(),
        metrics: data.record.metrics,
        key: data.record.key,
    };
}

async function runCruxHistory(rawUrl, apiKey, { scope = 'page' } = {}) {
    ensureCommandDir('crux-history');
    const output = await runCruxHistoryAudit(rawUrl, apiKey, { scope });
    const outputPath = buildFilename(output.url, 'crux-history');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    return outputPath;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
async function runCruxHistoryAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    return runBatch(
        urls,
        (url) => withRetry(() => runCruxHistoryAudit(url, apiKey, { scope }), { label: url }),
        { maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND, concurrency, delayMs, onProgress }
    );
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<Array<{url: string, outputPath: string|null, error: string|null}>>}
 */
async function runCruxHistoryBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('crux-history');
    return runBatch(
        urls,
        (url) => withRetry(() => runCruxHistoryAudit(url, apiKey, { scope }), { label: url }),
        {
            maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            writeFn: (url, data) => {
                const outputPath = buildFilename(data.url, 'crux-history');
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
                return outputPath;
            },
        }
    );
}

module.exports = { runCruxHistory, runCruxHistoryBatch, runCruxHistoryAudit, runCruxHistoryAuditBatch, CRUX_HISTORY_MAX_REQUESTS_PER_SECOND };
