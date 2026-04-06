/* eslint-disable no-await-in-loop */
const fs = require('fs');
const fetch = require('node-fetch');

const { ensureCommandDir, buildFilename, normalizeOrigin } = require('./utils');

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function buildRequestBody(url, scope) {
    if (scope === 'origin') {
        return { origin: normalizeOrigin(url) };
    }
    return { url };
}

async function runCrux(rawUrl, apiKey, { scope = 'page' } = {}) {
    ensureCommandDir('crux');

    const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
    const body = buildRequestBody(url, scope);

    const response = await fetch(`${CRUX_API_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const responseBody = await response.text();
        if (response.status === 404) {
            const target = scope === 'origin' ? `origin "${url}"` : `page "${url}"`;
            const err = new Error(
                `No CrUX data found for ${target}. Pages need ~300+ monthly visits to have data.`
            );
            err.statusCode = response.status;
            throw err;
        }
        const err = new Error(`CrUX API error (${response.status}): ${responseBody}`);
        err.statusCode = response.status;
        throw err;
    }

    const data = await response.json();

    const output = {
        source: 'crux-api',
        scope,
        url,
        collectionPeriod: data.record.collectionPeriod,
        extractedAt: new Date().toISOString(),
        metrics: data.record.metrics,
        key: data.record.key,
    };

    const outputPath = buildFilename(url, 'crux');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    return outputPath;
}

async function runCruxWithRetry(url, apiKey, { scope = 'page', maxRetries = 2, baseDelayMs = 2000 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runCrux(url, apiKey, { scope });
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

async function runCruxBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, onProgress } = {}) {
    ensureCommandDir('crux');
    const results = [];
    let completed = 0;
    const total = urls.length;
    const iterator = urls[Symbol.iterator]();

    async function worker() {
        for (const url of iterator) {
            let outputPath = null;
            let error = null;
            try {
                outputPath = await runCruxWithRetry(url, apiKey, { scope });
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

module.exports = { buildRequestBody, runCrux, runCruxBatch };
