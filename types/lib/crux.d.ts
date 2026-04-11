export type CruxDate = {
    year: number;
    month: number;
    day: number;
};
export type CruxCollectionPeriod = {
    firstDate: CruxDate;
    lastDate: CruxDate;
};
export type CruxHistogramBin = {
    start: number;
    end?: number;
    density: number;
};
export type CruxPercentiles = {
    p75: number;
};
export type CruxMetric = {
    histogram: CruxHistogramBin[];
    percentiles: CruxPercentiles;
    fractions?: Record<string, number>;
};
export type CruxKey = {
    origin?: string;
    url?: string;
};
export type CruxReport = {
    source: "crux-api";
    scope: "origin" | "page";
    url: string;
    collectionPeriod: CruxCollectionPeriod;
    extractedAt: string;
    metrics: Record<string, CruxMetric>;
    key: CruxKey;
};
export type CruxBatchResult = {
    url: string;
    data: CruxReport | null;
    error: string | null;
};
/**
 * @typedef {{ year: number, month: number, day: number }} CruxDate
 * @typedef {{ firstDate: CruxDate, lastDate: CruxDate }} CruxCollectionPeriod
 * @typedef {{ start: number, end?: number, density: number }} CruxHistogramBin
 * @typedef {{ p75: number }} CruxPercentiles
 * @typedef {{ histogram: CruxHistogramBin[], percentiles: CruxPercentiles, fractions?: Record<string, number> }} CruxMetric
 * @typedef {{ origin?: string, url?: string }} CruxKey
 */
/**
 * @typedef {Object} CruxReport
 * @property {'crux-api'} source
 * @property {'origin'|'page'} scope
 * @property {string} url
 * @property {CruxCollectionPeriod} collectionPeriod
 * @property {string} extractedAt
 * @property {Record<string, CruxMetric>} metrics
 * @property {CruxKey} key
 */
/**
 * @typedef {{ url: string, data: CruxReport|null, error: string|null }} CruxBatchResult
 */
export function buildRequestBody(url: any, scope: any): {
    origin: string;
    url?: undefined;
} | {
    url: any;
    origin?: undefined;
};
export function runCrux(rawUrl: any, apiKey: any, { scope }?: {
    scope?: string | undefined;
}): Promise<string>;
export function runCruxBatch(urls: any, apiKey: any, { scope, concurrency, delayMs, onProgress }?: {
    scope?: string | undefined;
    concurrency?: number | undefined;
    delayMs?: number | undefined;
}): Promise<any[]>;
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page' }} [options]
 * @returns {Promise<CruxReport>}
 */
export function runCruxAudit(rawUrl: string, apiKey: string, { scope }?: {
    scope?: "origin" | "page";
}): Promise<CruxReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxBatchResult[]>}
 */
export function runCruxAuditBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxBatchResult[]>;
export const CRUX_MAX_REQUESTS_PER_SECOND: 2.5;
