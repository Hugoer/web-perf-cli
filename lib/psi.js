/* eslint-disable no-await-in-loop */
const fs = require('fs');

const { ensureCommandDir, buildFilename, createRateLimiter, sleep } = require('./utils');

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_MAX_REQUESTS_PER_SECOND = 4;

/**
 * @typedef {{ start: number, end?: number, proportion: number }} PsiDistribution
 * @typedef {{ percentile: number, distributions: PsiDistribution[], category: 'FAST'|'AVERAGE'|'SLOW' }} PsiExperienceMetric
 * @typedef {{ metrics: Record<string, PsiExperienceMetric>, initial_url: string, overall_category: 'FAST'|'AVERAGE'|'SLOW'|'NONE', id: string }} PsiLoadingExperience
 */

/**
 * @typedef {Object} PsiCategoryScore
 * @property {string} id
 * @property {string} title
 * @property {number} score
 */

/**
 * @typedef {Object} PsiReport
 * @property {string} id
 * @property {string} kind
 * @property {string} analysisUTCTimestamp
 * @property {PsiLoadingExperience} loadingExperience
 * @property {PsiLoadingExperience} originLoadingExperience
 * @property {{ lighthouseVersion: string, requestedUrl: string, finalUrl: string, fetchTime: string, categories: Record<string, PsiCategoryScore>, audits: Record<string, unknown> }} lighthouseResult
 */

/**
 * @typedef {{ url: string, data: PsiReport|null, error: string|null }} PsiBatchResult
 */

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string[]} [categories]
 * @returns {Promise<PsiReport>}
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

async function runPsi(url, apiKey, categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) {
    ensureCommandDir('psi');
    const data = await runPsiAudit(url, apiKey, categories);
    const outputPath = buildFilename(url, 'psi');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
}

async function runPsiWithRetry(url, apiKey, categories, { maxRetries = 2, baseDelayMs = 2000 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runPsiAudit(url, apiKey, categories);
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
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
async function runPsiAuditBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, onProgress } = {}) {
    const waitForRateLimit = createRateLimiter({ maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND });
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
                data = await runPsiWithRetry(url, apiKey, categories);
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

async function runPsiBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('psi');
    const waitForRateLimit = createRateLimiter({ maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND });
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
                const data = await runPsiWithRetry(url, apiKey, categories);
                outputPath = buildFilename(url, 'psi');
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

module.exports = { runPsi, runPsiBatch, runPsiAudit, runPsiAuditBatch, PSI_MAX_REQUESTS_PER_SECOND };
