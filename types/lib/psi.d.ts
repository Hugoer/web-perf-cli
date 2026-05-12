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
/**
 * Runs PageSpeed Insights audits for a single URL across one or more strategies
 * and writes each result to disk.
 * @param {string} url - The URL to audit.
 * @param {string} apiKey - PageSpeed Insights API key.
 * @param {string[]} [categories] - Lighthouse categories to evaluate.
 * @param {{ clean?: boolean, strategies?: PsiStrategy[] }} [options]
 * @returns {Promise<string[]>} Output file paths, one per strategy in the order requested.
 */
export function runPsi(url: string, apiKey: string, categories?: string[], { clean, strategies }?: {
    clean?: boolean;
    strategies?: PsiStrategy[];
}): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, clean?: boolean, strategies?: PsiStrategy[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
export function runPsiBatch(urls: string[], apiKey: string, categories: string[], { concurrency, delayMs, clean, strategies, onProgress }?: {
    concurrency?: number;
    delayMs?: number;
    clean?: boolean;
    strategies?: PsiStrategy[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<PsiBatchResult[]>;
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
export function runPsiAudit(url: string, apiKey: string, categories?: string[], strategy?: PsiStrategy): Promise<PsiResponse>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, strategies?: PsiStrategy[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<Array<{ url: string, strategy: PsiStrategy, data: PsiResponse|null, error: string|null }>>}
 */
export function runPsiAuditBatch(urls: string[], apiKey: string, categories: string[], { concurrency, delayMs, strategies, onProgress }?: {
    concurrency?: number;
    delayMs?: number;
    strategies?: PsiStrategy[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<Array<{
    url: string;
    strategy: PsiStrategy;
    data: PsiResponse | null;
    error: string | null;
}>>;
export const PSI_MAX_REQUESTS_PER_SECOND: 4;
export const PSI_STRATEGIES: string[];
export const DEFAULT_PSI_STRATEGIES: string[];
import type { pagespeedonline_v5 } from '@googleapis/pagespeedonline';
