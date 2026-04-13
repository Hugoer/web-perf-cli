const fs = require('fs');

const { ensureCommandDir, buildFilename, withRetry, runBatch } = require('./utils');

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_MAX_REQUESTS_PER_SECOND = 4;

/** @import { pagespeedonline_v5 } from '@googleapis/pagespeedonline' */

/**
 * @typedef {pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5} PsiResponse
 * @typedef {PsiResponse} PsiReport
 * @typedef {{ url: string, data: PsiResponse|null, error: string|null }} PsiBatchResult
 */

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string[]} [categories]
 * @returns {Promise<PsiResponse>}
 */
async function runPsiAudit(url, apiKey, categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) {
    const categoryParams = categories.map((c) => `category=${c}`).join('&');
    const apiUrl = `${PSI_API_URL}?url=${encodeURIComponent(url)}&${categoryParams}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        const body = await response.text();
        const err = new Error(`PageSpeed Insights API error (${response.status}): ${body}`);
        err.statusCode = response.status;
        throw err;
    }

    return response.json();
}

/**
 * Runs a PageSpeed Insights audit for a single URL and writes the result to disk.
 * @param {string} url - The URL to audit.
 * @param {string} apiKey - PageSpeed Insights API key.
 * @param {string[]} [categories] - Lighthouse categories to evaluate.
 * @returns {Promise<string>} The file path where the result was written.
 */
async function runPsi(url, apiKey, categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) {
    ensureCommandDir('psi');
    const data = await runPsiAudit(url, apiKey, categories);
    const outputPath = buildFilename(url, 'psi');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
async function runPsiAuditBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, onProgress } = {}) {
    return runBatch(
        urls,
        (url) => withRetry(() => runPsiAudit(url, apiKey, categories), { label: url }),
        { maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND, concurrency, delayMs, onProgress }
    );
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<Array<{ url: string, outputPath: string|null, error: string|null }>>}
 */
async function runPsiBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('psi');
    return runBatch(
        urls,
        (url) => withRetry(() => runPsiAudit(url, apiKey, categories), { label: url }),
        {
            maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            writeFn: (url, data) => {
                const outputPath = buildFilename(url, 'psi');
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
                return outputPath;
            },
        }
    );
}

module.exports = { runPsi, runPsiBatch, runPsiAudit, runPsiAuditBatch, PSI_MAX_REQUESTS_PER_SECOND };
