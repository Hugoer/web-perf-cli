export type PsiStrategy = "mobile" | "desktop";
export type PsiResponse = pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5;
export type PsiReport = PsiResponse;
export type PsiWorkItem = {
    url: string;
    strategy: PsiStrategy;
};
export type PsiBatchResult = {
    url: string;
    strategy: PsiStrategy;
    outputPath: string | null;
    error: string | null;
};
export type PsiBatchOptions = {
    concurrency?: number | undefined;
    delayMs?: number | undefined;
    strategies?: readonly PsiStrategy[] | undefined;
    onProgress?: ((completed: number, total: number, url: string, error: string | null) => void) | undefined;
};
export type PsiWriteBatchOptions = PsiBatchOptions & {
    clean?: boolean;
};
/**
 * Runs PageSpeed Insights audits for a single URL across one or more strategies
 * and writes each result to disk.
 * @param {string} url - The URL to audit.
 * @param {string} apiKey - PageSpeed Insights API key.
 * @param {readonly string[]} [categories] - Lighthouse categories to evaluate.
 * @param {{ clean?: boolean, strategies?: readonly PsiStrategy[] }} [options]
 * @returns {Promise<string[]>} Output file paths, one per strategy in the order requested.
 */
export function runPsi(url: string, apiKey: string, categories?: readonly string[], { clean, strategies }?: {
    clean?: boolean;
    strategies?: readonly PsiStrategy[];
}): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {readonly string[]} categories
 * @param {PsiWriteBatchOptions} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
export function runPsiBatch(urls: string[], apiKey: string, categories: readonly string[], { concurrency, delayMs, clean, strategies, onProgress }?: PsiWriteBatchOptions): Promise<PsiBatchResult[]>;
/** @import { pagespeedonline_v5 } from '@googleapis/pagespeedonline' */
/**
 * @typedef {'mobile'|'desktop'} PsiStrategy
 * @typedef {pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5} PsiResponse
 * @typedef {PsiResponse} PsiReport
 * @typedef {{ url: string, strategy: PsiStrategy }} PsiWorkItem
 * @typedef {{ url: string, strategy: PsiStrategy, outputPath: string|null, error: string|null }} PsiBatchResult
 */
/**
 * @typedef {Object} PsiBatchOptions
 * @property {number} [concurrency]
 * @property {number} [delayMs]
 * @property {readonly PsiStrategy[]} [strategies]
 * @property {(completed: number, total: number, url: string, error: string|null) => void} [onProgress]
 */
/**
 * @typedef {PsiBatchOptions & { clean?: boolean }} PsiWriteBatchOptions
 */
/**
 * @param {string} url
 * @param {string} apiKey
 * @param {readonly string[]} [categories]
 * @param {PsiStrategy} [strategy]
 * @returns {Promise<PsiResponse>}
 */
export function runPsiAudit(url: string, apiKey: string, categories?: readonly string[], strategy?: PsiStrategy): Promise<PsiResponse>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {readonly string[]} categories
 * @param {PsiBatchOptions} [options]
 * @returns {Promise<Array<{ url: string, strategy: PsiStrategy, data: PsiResponse|null, error: string|null }>>}
 */
export function runPsiAuditBatch(urls: string[], apiKey: string, categories: readonly string[], { concurrency, delayMs, strategies, onProgress }?: PsiBatchOptions): Promise<Array<{
    url: string;
    strategy: PsiStrategy;
    data: PsiResponse | null;
    error: string | null;
}>>;
export const PSI_MAX_REQUESTS_PER_SECOND: 4;
export const PSI_STRATEGIES: readonly PsiStrategy[];
export const DEFAULT_PSI_STRATEGIES: readonly PsiStrategy[];
import type { pagespeedonline_v5 } from '@googleapis/pagespeedonline';
