const fs = require('fs');

const {
    ensureCommandDir, buildFilename, normalizeOrigin, withRetry, runBatch,
} = require('./utils');

const CRUX_MAX_REQUESTS_PER_SECOND = 2.5;
const CRUX_FORM_FACTORS = /** @type {const} */ (['phone', 'desktop', 'tablet']);
const DEFAULT_CRUX_FORM_FACTORS = ['phone', 'desktop'];

/**
 * @typedef {'phone'|'desktop'|'tablet'} CruxFormFactor
 *
 * @typedef {Object} CruxClientConfig
 * @property {string} endpoint - full REST endpoint for the query
 * @property {string} command - results subdirectory and filename prefix
 * @property {string} dataLabel - name used in error messages ("CrUX", "CrUX history")
 * @property {'collectionPeriod'|'collectionPeriods'} periodKey - the record field carrying
 *   the collection window. queryRecord returns one period; queryHistoryRecord returns many.
 * @property {number} [maxRequestsPerSecond] - request-start cap for batch runs, defaulting to
 *   CRUX_MAX_REQUESTS_PER_SECOND. Configurable rather than hard-coded because each module
 *   publishes its own quota constant: hard-coding one here left crux-history's exported
 *   CRUX_HISTORY_MAX_REQUESTS_PER_SECOND inert, so editing it would have changed nothing.
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
 * A 404 means the page or origin is not in the CrUX dataset, which is a fact about the page
 * rather than a failure of the request. Reported separately so it does not fail the run —
 * see docs/specs/SPEC-005.
 * @param {{ item: { url: string, formFactor: CruxFormFactor }, statusCode: number|null, error: string|null }} result
 */
function classify(result) {
    return {
        url: result.item.url,
        formFactor: result.item.formFactor,
        noData: result.statusCode === 404,
        error: result.statusCode === 404 ? null : result.error,
    };
}

/**
 * Builds the four entry points for one CrUX endpoint.
 *
 * `queryRecord` and `queryHistoryRecord` differ only in the endpoint, the results directory,
 * the label used in error messages, and whether a record carries `collectionPeriod` or
 * `collectionPeriods`. Everything else — origin normalisation, treating 404 as no-data,
 * retry, rate limiting, file naming — used to be duplicated line for line across crux.js and
 * crux-history.js, so every fix to that path had to be written twice.
 *
 * @param {CruxClientConfig} config
 */
function createCruxClient({
    endpoint, command, dataLabel, periodKey,
    maxRequestsPerSecond = CRUX_MAX_REQUESTS_PER_SECOND,
}) {
    async function runAudit(rawUrl, apiKey, { scope = 'page', formFactor } = {}) {
        const url = scope === 'origin' ? normalizeOrigin(rawUrl) : rawUrl;
        const body = buildRequestBody(url, scope, formFactor);
        const data = await callCruxApi(endpoint, body, apiKey, { scope, dataLabel });

        // Key order is the written file's key order, so it is kept as the two modules had it.
        return {
            source: 'crux-api',
            scope,
            formFactor: formFactor || null,
            url,
            [periodKey]: data.record[periodKey],
            extractedAt: new Date().toISOString(),
            metrics: data.record.metrics,
            key: data.record.key,
        };
    }

    async function run(rawUrl, apiKey, { scope = 'page', formFactors = DEFAULT_CRUX_FORM_FACTORS, onNoData } = {}) {
        ensureCommandDir(command);
        const paths = [];
        for (const formFactor of formFactors) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const output = await runAudit(rawUrl, apiKey, { scope, formFactor });
                const outputPath = buildFilename(output.url, command, formFactor);
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

    /** Shared plumbing for both batch entry points; only the write step differs. */
    function batch(urls, apiKey, { scope, concurrency, delayMs, formFactors, onProgress }, writeFn) {
        const items = urls.flatMap((url) => formFactors.map((formFactor) => ({ url, formFactor })));
        return runBatch(
            items,
            (item) => withRetry(
                () => runAudit(item.url, apiKey, { scope, formFactor: item.formFactor }),
                { label: `${item.url} [${item.formFactor}]` },
            ),
            {
                maxRequestsPerSecond,
                concurrency,
                delayMs,
                onProgress,
                urlOf: (item) => item.url,
                ...(writeFn && { writeFn }),
            },
        );
    }

    async function runAuditBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
        const results = await batch(urls, apiKey, {
            scope, concurrency, delayMs, formFactors, onProgress,
        });
        return results.map((r) => ({ ...classify(r), data: r.data ?? null }));
    }

    async function runWriteBatch(urls, apiKey, { scope = 'page', concurrency = 5, delayMs = 0, formFactors = DEFAULT_CRUX_FORM_FACTORS, onProgress } = {}) {
        ensureCommandDir(command);
        const results = await batch(
            urls,
            apiKey,
            {
                scope, concurrency, delayMs, formFactors, onProgress,
            },
            (item, data) => {
                const outputPath = buildFilename(data.url, command, item.formFactor);
                fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
                return outputPath;
            },
        );
        return results.map((r) => ({ ...classify(r), outputPath: r.outputPath ?? null }));
    }

    return {
        runAudit, run, runAuditBatch, runWriteBatch,
    };
}

module.exports = {
    buildRequestBody,
    callCruxApi,
    createCruxClient,
    CRUX_MAX_REQUESTS_PER_SECOND,
    CRUX_FORM_FACTORS,
    DEFAULT_CRUX_FORM_FACTORS,
};
