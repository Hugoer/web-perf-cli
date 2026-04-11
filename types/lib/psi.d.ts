export type PsiDistribution = {
    start: number;
    end?: number;
    proportion: number;
};
export type PsiExperienceMetric = {
    percentile: number;
    distributions: PsiDistribution[];
    category: "FAST" | "AVERAGE" | "SLOW";
};
export type PsiLoadingExperience = {
    metrics: Record<string, PsiExperienceMetric>;
    initial_url: string;
    overall_category: "FAST" | "AVERAGE" | "SLOW" | "NONE";
    id: string;
};
export type PsiCategoryScore = {
    id: string;
    title: string;
    score: number;
};
export type PsiReport = {
    id: string;
    kind: string;
    analysisUTCTimestamp: string;
    loadingExperience: PsiLoadingExperience;
    originLoadingExperience: PsiLoadingExperience;
    lighthouseResult: {
        lighthouseVersion: string;
        requestedUrl: string;
        finalUrl: string;
        fetchTime: string;
        categories: Record<string, PsiCategoryScore>;
        audits: Record<string, unknown>;
    };
};
export type PsiBatchResult = {
    url: string;
    data: PsiReport | null;
    error: string | null;
};
export function runPsi(url: any, apiKey: any, categories?: string[]): Promise<string>;
export function runPsiBatch(urls: any, apiKey: any, categories: any, { concurrency, delayMs, onProgress }?: {
    concurrency?: number | undefined;
    delayMs?: number | undefined;
}): Promise<any[]>;
/**
 * @typedef {{ start: number, end?: number, proportion: number }} PsiDistribution
 * @typedef {{ percentile: number, distributions: PsiDistribution[], category: 'FAST'|'AVERAGE'|'SLOW' }} PsiExperienceMetric
 * @typedef {{ metrics: Record<string, PsiExperienceMetric>, initial_url: string, overall_category: 'FAST'|'AVERAGE'|'SLOW'|'NONE', id: string }} PsiLoadingExperience
 */
/**
 * @typedef {Object} PsiCategoryScore
 * @property {string} id
 * @property {string} title
 * @property {number} score
 */
/**
 * @typedef {Object} PsiReport
 * @property {string} id
 * @property {string} kind
 * @property {string} analysisUTCTimestamp
 * @property {PsiLoadingExperience} loadingExperience
 * @property {PsiLoadingExperience} originLoadingExperience
 * @property {{ lighthouseVersion: string, requestedUrl: string, finalUrl: string, fetchTime: string, categories: Record<string, PsiCategoryScore>, audits: Record<string, unknown> }} lighthouseResult
 */
/**
 * @typedef {{ url: string, data: PsiReport|null, error: string|null }} PsiBatchResult
 */
/**
 * @param {string} url
 * @param {string} apiKey
 * @param {string[]} [categories]
 * @returns {Promise<PsiReport>}
 */
export function runPsiAudit(url: string, apiKey: string, categories?: string[]): Promise<PsiReport>;
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
