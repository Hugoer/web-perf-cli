export type CruxHistoryReport = chromeuxreport_v1.Schema$HistoryRecord & {
    source: "crux-api";
    scope: "origin" | "page";
    url: string;
    extractedAt: string;
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
/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */
/**
 * @typedef {chromeuxreport_v1.Schema$HistoryRecord & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   url: string,
 *   extractedAt: string
 * }} CruxHistoryReport
 *
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
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
