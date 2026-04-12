/* eslint-disable no-await-in-loop */
const fs = require('fs');

const { buildRequestBody } = require('./crux');
const { ensureCommandDir, buildFilename, normalizeOrigin, createRateLimiter, sleep } = require('./utils');

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

    const response = await fetch(`${CRUX_HISTORY_API_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const responseBody = await response.text();
        if (response.status === 404) {
            const target = scope === 'origin' ? `origin "${url}"` : `page "${url}"`;
            const err = new Error(
                `No CrUX history data found for ${target}. Pages need ~300+ monthly visits to have data.`
            );
            err.statusCode = response.status;
            throw err;
        }
        const err = new Error(`CrUX History API error (${response.status}): ${responseBody}`);
        err.statusCode = response.status;
        throw err;
    }

    const data = await response.json();

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

async function runCruxHistoryWithRetry(url, apiKey, { scope = 'page', maxRetries = 2, baseDelayMs = 2000 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runCruxHistoryAudit(url, apiKey, { scope });
        } catch (err) {
            const retryable = err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode < 600);
            if (retryable && attempt < maxRetries) {
                const wait = baseDelayMs * 2 ** attempt;
                process.stderr.write(`\n  Retrying ${url} in ${wait}ms (attempt ${attempt + 1})...\n`);
                await sleep(wait);
            } else {
                throw err;
            }
        }
    }
    return undefined;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
async function runCruxHistoryAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    const waitForRateLimit = createRateLimiter({ maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND });
    const results = [];
    let completed = 0;
    const total = urls.length;
    const iterator = urls[Symbol.iterator]();

    async function worker() {
        for (const url of iterator) {
            let data = null;
            let error = null;
            try {
                await waitForRateLimit();
                data = await runCruxHistoryWithRetry(url, apiKey, { scope });
            } catch (err) {
                error = err.message;
            }
            completed++;
            results.push({ url, data, error });
            if (onProgress) {
                onProgress(completed, total, url, error);
            }
            if (delayMs > 0) {
                await sleep(delayMs);
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
    return results;
}

async function runCruxHistoryBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('crux-history');
    const waitForRateLimit = createRateLimiter({ maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND });
    const results = [];
    let completed = 0;
    const total = urls.length;
    const iterator = urls[Symbol.iterator]();

    async function worker() {
        for (const url of iterator) {
            let outputPath = null;
            let error = null;
            try {
                await waitForRateLimit();
                const data = await runCruxHistoryWithRetry(url, apiKey, { scope });
                outputPath = buildFilename(data.url, 'crux-history');
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
            } catch (err) {
                error = err.message;
            }
            completed++;
            results.push({ url, outputPath, error });
            if (onProgress) {
                onProgress(completed, total, url, error);
            }
            if (delayMs > 0) {
                await sleep(delayMs);
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);

    return results;
}

module.exports = { runCruxHistory, runCruxHistoryBatch, runCruxHistoryAudit, runCruxHistoryAuditBatch, CRUX_HISTORY_MAX_REQUESTS_PER_SECOND };
