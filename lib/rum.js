/* eslint-disable no-await-in-loop */
const fs = require('fs');
const fetch = require('node-fetch');

const { ensureCommandDir, buildFilename } = require('./utils');

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function runRum(url, apiKey, categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) {
    ensureCommandDir('rum');
    const categoryParams = categories.map((c) => `category=${c}`).join('&');
    const apiUrl = `${PSI_API_URL}?url=${encodeURIComponent(url)}&${categoryParams}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        const body = await response.text();
        const err = new Error(`PageSpeed Insights API error (${response.status}): ${body}`);
        err.statusCode = response.status;
        throw err;
    }

    const data = await response.json();
    const outputPath = buildFilename(url, 'rum');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    return outputPath;
}

async function runRumWithRetry(url, apiKey, categories, { maxRetries = 2, baseDelayMs = 2000 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runRum(url, apiKey, categories);
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

async function runRumBatch(urls, apiKey, categories, { concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('rum');
    const results = [];
    let completed = 0;
    const total = urls.length;
    const iterator = urls[Symbol.iterator]();

    async function worker() {
        for (const url of iterator) {
            let outputPath = null;
            let error = null;
            try {
                outputPath = await runRumWithRetry(url, apiKey, categories);
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

module.exports = { runRum, runRumBatch };
