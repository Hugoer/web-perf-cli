/* eslint-disable no-await-in-loop */
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function ensureCommandDir(command) {
    fs.mkdirSync(path.join(RESULTS_DIR, command), { recursive: true });
}

function formatDate() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = String(now.getUTCSeconds()).padStart(2, '0');
    return `${date}-${hours}${mins}${secs}`;
}

function buildFilename(url, command, suffix, ext = 'json') {
    const hostname = new URL(url).hostname;
    const suffixPart = suffix ? `-${suffix}` : '';
    const base = path.join(RESULTS_DIR, command, `${command}-${hostname}-${formatDate()}${suffixPart}`);
    if (!fs.existsSync(`${base}.${ext}`)) {
        return `${base}.${ext}`;
    }
    let i = 1;
    while (fs.existsSync(`${base}_${String(i).padStart(2, '0')}.${ext}`)) {
        i++;
    }
    return `${base}_${String(i).padStart(2, '0')}.${ext}`;
}

function formatElapsed(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function normalizeOrigin(url) {
    const full = url.startsWith('http') ? url : `https://${url}`;
    return new URL(full).origin;
}

/**
 * Maps URLs to their origins and removes the duplicates that collapse onto the same origin.
 * Distinct pages of one site (`https://a.com/x`, `https://a.com/y`) become a single origin,
 * so origin-scoped commands issue one request instead of N identical ones.
 * @param {string[]} urls
 * @returns {{ origins: string[], normalized: Array<{ from: string, to: string }>, duplicatesRemoved: number }}
 */
function normalizeUrlsToOrigins(urls) {
    const normalized = [];
    const mapped = urls.map((u) => {
        const origin = normalizeOrigin(u);
        const full = u.startsWith('http') ? u : `https://${u}`;
        if (full.replace(/\/+$/, '') !== origin) {
            normalized.push({ from: u, to: origin });
        }
        return origin;
    });
    const origins = [...new Set(mapped)];
    return { origins, normalized, duplicatesRemoved: mapped.length - origins.length };
}

function normalizeUrlForAi(url) {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

function writeAiOutput(urls, referenceUrl, command) {
    ensureCommandDir(command);
    const normalized = urls.map(normalizeUrlForAi);
    const unique = [...new Set(normalized)];
    const outputPath = buildFilename(referenceUrl, command, undefined, 'txt');
    fs.writeFileSync(outputPath, unique.join('\n'));
    return outputPath;
}

function createRateLimiter({ maxRequestsPerSecond }) {
    if (!Number.isFinite(maxRequestsPerSecond) || maxRequestsPerSecond <= 0) {
        throw new Error('maxRequestsPerSecond must be a positive number');
    }

    const minIntervalMs = Math.ceil(1000 / maxRequestsPerSecond);
    let nextAllowedAt = 0;
    let lock = Promise.resolve();

    return async function waitForTurn() {
        let release;
        const previous = lock;
        lock = new Promise((resolve) => {
            release = resolve;
        });

        await previous;
        try {
            const slotTime = Math.max(nextAllowedAt, Date.now());
            const waitMs = slotTime - Date.now();
            if (waitMs > 0) {
                await sleep(waitMs);
            }
            nextAllowedAt = slotTime + minIntervalMs;
        } finally {
            release();
        }
    };
}

// Transient network conditions worth a second attempt. ENOTFOUND and ECONNREFUSED are
// deliberately absent: a hostname that does not resolve, or a port with nothing behind it,
// is nearly always a permanent mistake, and retrying one costs the full backoff on every
// URL of a batch that was never going to succeed.
const RETRYABLE_NETWORK_CODES = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENETUNREACH',
    'ENETDOWN',
    'EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_SOCKET',
]);

/**
 * Finds the OS/undici error code on an error or anywhere in its `cause` chain.
 *
 * Global `fetch` rejects with a bare `TypeError: fetch failed` and hangs the real reason
 * off `cause`, so the code is never on the error that callers actually catch.
 * @param {unknown} err
 * @returns {string|null}
 */
function networkErrorCode(err) {
    let current = err;
    // Bounded rather than while(current): a cause chain that loops would otherwise hang.
    for (let depth = 0; current && depth < 5; depth++) {
        if (typeof current.code === 'string') {
            return current.code;
        }
        current = current.cause;
    }
    return null;
}

/**
 * Decides whether a failed attempt is worth repeating: an HTTP 429 or 5xx, or a transient
 * network fault. An error carrying any other `statusCode` came back from the server and is
 * answered, not transient, so the network codes are consulted only when there is no status.
 * @param {unknown} err
 * @returns {boolean}
 */
function isRetryableError(err) {
    if (!err) {
        return false;
    }
    const { statusCode } = err;
    if (statusCode !== undefined && statusCode !== null) {
        return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    }
    return RETRYABLE_NETWORK_CODES.has(networkErrorCode(err));
}

/**
 * Retries an async function on transient failures (429, 5xx, or a network fault) with
 * exponential backoff.
 * @param {() => Promise<any>} fn
 * @param {{ maxRetries?: number, baseDelayMs?: number, label?: string, _sleep?: (ms: number) => Promise<void> }} [opts]
 */
async function withRetry(fn, { maxRetries = 2, baseDelayMs = 2000, label = '', _sleep: sleepFn = sleep } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (isRetryableError(err) && attempt < maxRetries) {
                const wait = baseDelayMs * 2 ** attempt;
                process.stderr.write(`\n  Retrying ${label} in ${wait}ms (attempt ${attempt + 1})...\n`);
                await sleepFn(wait);
            } else {
                throw err;
            }
        }
    }
    return undefined;
}

/**
 * Runs an audit function over a list of work items using a worker pool with rate limiting.
 * Items may be plain URL strings or arbitrary objects; supply `urlOf` to extract the URL
 * string from an object item (used for progress reporting and the `url` field on results).
 * @template T - the work-item shape (string or object)
 * @template R - the audit result shape
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} auditFn
 * @param {{
 *   maxRequestsPerSecond: number,
 *   concurrency?: number,
 *   delayMs?: number,
 *   onProgress?: (completed: number, total: number, url: string, error: string|null, statusCode: number|null) => void,
 *   writeFn?: (item: T, data: R) => string,
 *   urlOf?: (item: T) => string,
 * }} opts
 * @returns {Promise<Array<{ url: string, item: T, data?: R, outputPath?: string, error: string|null, statusCode: number|null }>>}
 */
async function runBatch(items, auditFn, { maxRequestsPerSecond, concurrency = 5, delayMs = 0, onProgress, writeFn, urlOf } = {}) {
    const waitForRateLimit = createRateLimiter({ maxRequestsPerSecond });
    const getUrl = urlOf || ((x) => x);
    const results = [];
    let completed = 0;
    const total = items.length;
    const iterator = items[Symbol.iterator]();

    async function worker() {
        for (const item of iterator) {
            const url = getUrl(item);
            let data = null;
            let outputPath = null;
            let error = null;
            let statusCode = null;
            try {
                await waitForRateLimit();
                data = await auditFn(item);
                if (writeFn) {
                    outputPath = writeFn(item, data);
                    data = null;
                }
            } catch (err) {
                error = err.message;
                // Preserved so callers can tell apart failure kinds — a CrUX 404 means the
                // page has no field data, which is not the same as the request failing.
                statusCode = err.statusCode ?? null;
            }
            completed++;
            results.push(writeFn
                ? { url, item, outputPath, error, statusCode }
                : { url, item, data, error, statusCode });
            if (onProgress) {
                onProgress(completed, total, url, error, statusCode);
            }
            if (delayMs > 0) {
                await sleep(delayMs);
            }
        }
    }

    if (total === 0) {
        return results;
    }
    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
    return results;
}

module.exports = {
    ensureCommandDir,
    buildFilename,
    formatDate,
    formatElapsed,
    normalizeOrigin,
    normalizeUrlsToOrigins,
    normalizeUrlForAi,
    writeAiOutput,
    createRateLimiter,
    withRetry,
    isRetryableError,
    runBatch,
    sleep,
    RESULTS_DIR,
};
