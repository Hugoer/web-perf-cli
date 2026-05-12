const fs = require('fs');
const path = require('path');

const { cleanPsiReport } = require('./clean');
const { ensureCommandDir, buildFilename, withRetry, runBatch } = require('./utils');

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_MAX_REQUESTS_PER_SECOND = 4;
const PSI_STRATEGIES = ['mobile', 'desktop'];
const DEFAULT_PSI_STRATEGIES = ['mobile', 'desktop'];
const DEFAULT_PSI_CATEGORIES = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'];

/** @import { pagespeedonline_v5 } from '@googleapis/pagespeedonline' */

/**
 * @typedef {'mobile'|'desktop'} PsiStrategy
 * @typedef {pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5} PsiResponse
 * @typedef {PsiResponse} PsiReport
 * @typedef {{ url: string, strategy: PsiStrategy }} PsiWorkItem
 * @typedef {{ url: string, strategy: PsiStrategy, outputPath: string|null, error: string|null }} PsiBatchResult
 */

/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string[]} [categories]
 * @param {PsiStrategy} [strategy]
 * @returns {Promise<PsiResponse>}
 */
async function runPsiAudit(url, apiKey, categories = DEFAULT_PSI_CATEGORIES, strategy = 'mobile') {
    const params = new URLSearchParams();
    params.set('url', url);
    params.set('key', apiKey);
    params.set('strategy', strategy.toUpperCase());
    for (const c of categories) {
        params.append('category', c);
    }
    const response = await fetch(`${PSI_API_URL}?${params.toString()}`);

    if (!response.ok) {
        const body = await response.text();
        const err = new Error(`PageSpeed Insights API error (${response.status}): ${body}`);
        err.statusCode = response.status;
        throw err;
    }

    return response.json();
}

/**
 * Writes a PSI report (and optionally a clean copy) to disk for one (url, strategy) pair.
 * @param {string} url
 * @param {PsiStrategy} strategy
 * @param {PsiResponse} data
 * @param {boolean} clean
 * @returns {string} Raw report path.
 */
function writePsiReport(url, strategy, data, clean) {
    const outputPath = buildFilename(url, 'psi', strategy);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    if (clean === true) {
        const cleanDir = path.join(path.dirname(outputPath), 'clean');
        fs.mkdirSync(cleanDir, { recursive: true });
        const base = path.basename(outputPath, '.json');
        const cleanOutputPath = path.join(cleanDir, `${base}.clean.json`);
        fs.writeFileSync(cleanOutputPath, JSON.stringify(cleanPsiReport(data), null, 2));
    }
    return outputPath;
}

/**
 * Runs PageSpeed Insights audits for a single URL across one or more strategies
 * and writes each result to disk.
 * @param {string} url - The URL to audit.
 * @param {string} apiKey - PageSpeed Insights API key.
 * @param {string[]} [categories] - Lighthouse categories to evaluate.
 * @param {{ clean?: boolean, strategies?: PsiStrategy[] }} [options]
 * @returns {Promise<string[]>} Output file paths, one per strategy in the order requested.
 */
async function runPsi(url, apiKey, categories = DEFAULT_PSI_CATEGORIES, { clean = false, strategies = DEFAULT_PSI_STRATEGIES } = {}) {
    ensureCommandDir('psi');
    const paths = [];
    for (const strategy of strategies) {
        // eslint-disable-next-line no-await-in-loop
        const data = await runPsiAudit(url, apiKey, categories, strategy);
        paths.push(writePsiReport(url, strategy, data, clean));
    }
    return paths;
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, strategies?: PsiStrategy[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<Array<{ url: string, strategy: PsiStrategy, data: PsiResponse|null, error: string|null }>>}
 */
async function runPsiAuditBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, strategies = DEFAULT_PSI_STRATEGIES, onProgress } = {}) {
    const items = urls.flatMap((url) => strategies.map((strategy) => ({ url, strategy })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runPsiAudit(item.url, apiKey, categories, item.strategy),
            { label: `${item.url} [${item.strategy}]` },
        ),
        {
            maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            urlOf: (item) => item.url,
        },
    );
    return results.map((r) => ({
        url: r.item.url,
        strategy: r.item.strategy,
        data: r.data ?? null,
        error: r.error,
    }));
}

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, clean?: boolean, strategies?: PsiStrategy[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
async function runPsiBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, clean = false, strategies = DEFAULT_PSI_STRATEGIES, onProgress } = {}) {
    ensureCommandDir('psi');
    const items = urls.flatMap((url) => strategies.map((strategy) => ({ url, strategy })));
    const results = await runBatch(
        items,
        (item) => withRetry(
            () => runPsiAudit(item.url, apiKey, categories, item.strategy),
            { label: `${item.url} [${item.strategy}]` },
        ),
        {
            maxRequestsPerSecond: PSI_MAX_REQUESTS_PER_SECOND,
            concurrency,
            delayMs,
            onProgress,
            urlOf: (item) => item.url,
            writeFn: (item, data) => writePsiReport(item.url, item.strategy, data, clean),
        },
    );
    return results.map((r) => ({
        url: r.item.url,
        strategy: r.item.strategy,
        outputPath: r.outputPath ?? null,
        error: r.error,
    }));
}

module.exports = {
    runPsi,
    runPsiBatch,
    runPsiAudit,
    runPsiAuditBatch,
    PSI_MAX_REQUESTS_PER_SECOND,
    PSI_STRATEGIES,
    DEFAULT_PSI_STRATEGIES,
};
