export type CruxDate = import("./crux").CruxDate;
export type CruxCollectionPeriod = import("./crux").CruxCollectionPeriod;
export type CruxMetric = import("./crux").CruxMetric;
export type CruxKey = import("./crux").CruxKey;
export type CruxHistoryReport = {
    source: "crux-api";
    scope: "origin" | "page";
    url: string;
    collectionPeriods: CruxCollectionPeriod[];
    extractedAt: string;
    metrics: Record<string, CruxMetric>;
    key: CruxKey;
};
export type CruxHistoryBatchResult = {
    url: string;
    data: CruxHistoryReport | null;
    error: string | null;
};
export function runCruxHistory(rawUrl: any, apiKey: any, { scope }?: {
    scope?: string | undefined;
}): Promise<string>;
export function runCruxHistoryBatch(urls: any, apiKey: any, { scope, concurrency, delayMs, onProgress }?: {
    scope?: string | undefined;
    concurrency?: number | undefined;
    delayMs?: number | undefined;
}): Promise<any[]>;
/**
 * @typedef {import('./crux').CruxDate} CruxDate
 * @typedef {import('./crux').CruxCollectionPeriod} CruxCollectionPeriod
 * @typedef {import('./crux').CruxMetric} CruxMetric
 * @typedef {import('./crux').CruxKey} CruxKey
 */
/**
 * @typedef {Object} CruxHistoryReport
 * @property {'crux-api'} source
 * @property {'origin'|'page'} scope
 * @property {string} url
 * @property {CruxCollectionPeriod[]} collectionPeriods
 * @property {string} extractedAt
 * @property {Record<string, CruxMetric>} metrics
 * @property {CruxKey} key
 */
/**
 * @typedef {{ url: string, data: CruxHistoryReport|null, error: string|null }} CruxHistoryBatchResult
 */
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page' }} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
export function runCruxHistoryAudit(rawUrl: string, apiKey: string, { scope }?: {
    scope?: "origin" | "page";
}): Promise<CruxHistoryReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
export function runCruxHistoryAuditBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxHistoryBatchResult[]>;
export const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND: 2.5;
