export function ensureCommandDir(command: any): void;
export function buildFilename(url: any, command: any, suffix: any, ext?: string): string;
export function formatDate(): string;
export function formatElapsed(ms: any): string;
export function normalizeOrigin(url: any): string;
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
 * Runs an audit function over a list of URLs using a worker pool with rate limiting.
 * @template T
 * @param {string[]} urls
 * @param {(url: string) => Promise<T>} auditFn
 * @param {{
 *   maxRequestsPerSecond: number,
 *   concurrency?: number,
 *   delayMs?: number,
 *   onProgress?: (completed: number, total: number, url: string, error: string|null) => void,
 *   writeFn?: (url: string, data: T) => string,
 * }} opts
 * @returns {Promise<Array<{ url: string, data?: T, outputPath?: string, error: string|null }>>}
 */
export function runBatch<T>(urls: string[], auditFn: (url: string) => Promise<T>, { maxRequestsPerSecond, concurrency, delayMs, onProgress, writeFn }?: {
    maxRequestsPerSecond: number;
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
    writeFn?: (url: string, data: T) => string;
}): Promise<Array<{
    url: string;
    data?: T;
    outputPath?: string;
    error: string | null;
}>>;
export function sleep(ms: any): Promise<any>;
export const RESULTS_DIR: string;
