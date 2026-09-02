export function ensureCommandDir(command: any): void;
export function buildFilename(url: any, command: any, suffix: any, ext?: string): string;
export function formatDate(): string;
export function formatElapsed(ms: any): string;
export function normalizeOrigin(url: any): string;
/**
 * Maps URLs to their origins and removes the duplicates that collapse onto the same origin.
 * Distinct pages of one site (`https://a.com/x`, `https://a.com/y`) become a single origin,
 * so origin-scoped commands issue one request instead of N identical ones.
 * @param {string[]} urls
 * @returns {{ origins: string[], normalized: Array<{ from: string, to: string }>, duplicatesRemoved: number }}
 */
export function normalizeUrlsToOrigins(urls: string[]): {
    origins: string[];
    normalized: Array<{
        from: string;
        to: string;
    }>;
    duplicatesRemoved: number;
};
export function normalizeUrlForAi(url: any): string;
export function writeAiOutput(urls: any, referenceUrl: any, command: any): string;
export function createRateLimiter({ maxRequestsPerSecond }: {
    maxRequestsPerSecond: any;
}): () => Promise<void>;
/**
 * Retries an async function on transient failures (429 or 5xx) with exponential backoff.
 * @param {() => Promise<any>} fn
 * @param {{ maxRetries?: number, baseDelayMs?: number, label?: string, _sleep?: (ms: number) => Promise<void> }} [opts]
 */
export function withRetry(fn: () => Promise<any>, { maxRetries, baseDelayMs, label, _sleep: sleepFn }?: {
    maxRetries?: number;
    baseDelayMs?: number;
    label?: string;
    _sleep?: (ms: number) => Promise<void>;
}): Promise<any>;
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
 *   onProgress?: (completed: number, total: number, url: string, error: string|null) => void,
 *   writeFn?: (item: T, data: R) => string,
 *   urlOf?: (item: T) => string,
 * }} opts
 * @returns {Promise<Array<{ url: string, item: T, data?: R, outputPath?: string, error: string|null, statusCode: number|null }>>}
 */
export function runBatch<T, R>(items: T[], auditFn: (item: T) => Promise<R>, { maxRequestsPerSecond, concurrency, delayMs, onProgress, writeFn, urlOf }?: {
    maxRequestsPerSecond: number;
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
    writeFn?: (item: T, data: R) => string;
    urlOf?: (item: T) => string;
}): Promise<Array<{
    url: string;
    item: T;
    data?: R;
    outputPath?: string;
    error: string | null;
    statusCode: number | null;
}>>;
export function sleep(ms: any): Promise<any>;
export const RESULTS_DIR: string;
