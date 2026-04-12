export type PsiResponse = pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5;
/**
 * -
 */
export type PsiReport = PsiResponse;
export type PsiBatchResult = {
    url: string;
    data: PsiResponse | null;
    error: string | null;
};
export function runPsi(url: any, apiKey: any, categories?: string[]): Promise<string>;
export function runPsiBatch(urls: any, apiKey: any, categories: any, { concurrency, delayMs, onProgress }?: {
    concurrency?: number | undefined;
    delayMs?: number | undefined;
}): Promise<any[]>;
/** @import { pagespeedonline_v5 } from '@googleapis/pagespeedonline' */
/**
 * @typedef {pagespeedonline_v5.Schema$PagespeedApiPagespeedResponseV5} PsiResponse
 * @typedef {PsiResponse} PsiReport - @deprecated Use PsiResponse instead.
 * @typedef {{ url: string, data: PsiResponse|null, error: string|null }} PsiBatchResult
 */
/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string[]} [categories]
 * @returns {Promise<PsiResponse>}
 */
export function runPsiAudit(url: string, apiKey: string, categories?: string[]): Promise<PsiResponse>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {string[]} categories
 * @param {{ concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<PsiBatchResult[]>}
 */
export function runPsiAuditBatch(urls: string[], apiKey: string, categories: string[], { concurrency, delayMs, onProgress }?: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<PsiBatchResult[]>;
export const PSI_MAX_REQUESTS_PER_SECOND: 4;
import type { pagespeedonline_v5 } from '@googleapis/pagespeedonline';
