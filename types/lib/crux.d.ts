export type CruxReport = chromeuxreport_v1.Schema$Record & {
    source: "crux-api";
    scope: "origin" | "page";
    url: string;
    extractedAt: string;
};
export type CruxBatchResult = {
    url: string;
    data: CruxReport | null;
    error: string | null;
};
/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */
/**
 * @typedef {chromeuxreport_v1.Schema$Record & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   url: string,
 *   extractedAt: string
 * }} CruxReport
 *
 * @typedef {{ url: string, data: CruxReport|null, error: string|null }} CruxBatchResult
 */
export function buildRequestBody(url: any, scope: any): {
    origin: string;
    url?: undefined;
} | {
    url: any;
    origin?: undefined;
};
export function callCruxApi(endpointUrl: any, body: any, apiKey: any, { scope, dataLabel }?: {
    scope?: string | undefined;
    dataLabel?: string | undefined;
}): Promise<any>;
export function runCrux(rawUrl: any, apiKey: any, { scope }?: {
    scope?: string | undefined;
}): Promise<string>;
export function runCruxBatch(urls: any, apiKey: any, { scope, concurrency, delayMs, onProgress }?: {
    scope?: string | undefined;
    concurrency?: number | undefined;
    delayMs?: number | undefined;
}): Promise<{
    url: string;
    item: any;
    data?: any;
    outputPath?: string;
    error: string | null;
}[]>;
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
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
