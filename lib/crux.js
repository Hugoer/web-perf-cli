const fs = require('fs');

const { ensureCommandDir, buildFilename, normalizeOrigin, withRetry, runBatch } = require('./utils');

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const CRUX_MAX_REQUESTS_PER_SECOND = 2.5;

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {chromeuxreport_v1.Schema$Record & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   url: string,
 *   extractedAt: string
 * }} CruxReport
 *
 * @typedef {{ url: string, data: CruxReport|null, error: string|null }} CruxBatchResult
 */

function buildRequestBody(url, scope) {
    if (scope === 'origin') {
        return { origin: normalizeOrigin(url) };
    }
    return { url };
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
 * @param {{ scope?: 'origin'|'page' }} [options]
 * @returns {Promise<CruxReport>}
 */
async function runCruxAudit(rawUrl, apiKey, { scope = 'page' } = {}) {
    const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
    const body = buildRequestBody(url, scope);
    const data = await callCruxApi(CRUX_API_URL, body, apiKey, { scope, dataLabel: 'CrUX' });

    return {
        source: 'crux-api',
        scope,
        url,
        collectionPeriod: data.record.collectionPeriod,
        extractedAt: new Date().toISOString(),
        metrics: data.record.metrics,
        key: data.record.key,
    };
}

async function runCrux(rawUrl, apiKey, { scope = 'page' } = {}) {
    ensureCommandDir('crux');
    const output = await runCruxAudit(rawUrl, apiKey, { scope });
    const outputPath = buildFilename(output.url, 'crux');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    return outputPath;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxBatchResult[]>}
 */
async function runCruxAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    return runBatch(
        urls,
        (url) => withRetry(() => runCruxAudit(url, apiKey, { scope }), { label: url }),
        { maxRequestsPerSecond: CRUX_MAX_REQUESTS_PER_SECOND, concurrency, delayMs, onProgress }
    );
}

async function runCruxBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('crux');
    return runBatch(
        urls,
        (url) => withRetry(() => runCruxAudit(url, apiKey, { scope }), { label: url }),
        {
            maxRequestsPerSecond: CRUX_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            writeFn: (url, data) => {
                const outputPath = buildFilename(data.url, 'crux');
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
                return outputPath;
            },
        }
    );
}

module.exports = { buildRequestBody, callCruxApi, runCrux, runCruxBatch, runCruxAudit, runCruxAuditBatch, CRUX_MAX_REQUESTS_PER_SECOND };
