export type CruxFormFactor = import("./crux").CruxFormFactor;
export type CruxHistoryReport = chromeuxreport_v1.Schema$HistoryRecord & {
    source: "crux-api";
    scope: "origin" | "page";
    formFactor: CruxFormFactor | null;
    url: string;
    extractedAt: string;
};
export type CruxHistoryBatchResult = {
    url: string;
    formFactor: CruxFormFactor;
    data: CruxHistoryReport | null;
    error: string | null;
};
export type CruxHistoryBatchWriteResult = {
    url: string;
    formFactor: CruxFormFactor;
    outputPath: string | null;
    error: string | null;
};
/**
 * Runs CrUX History audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactors?: CruxFormFactor[], onNoData?: (formFactor: CruxFormFactor, message: string) => void }} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
export function runCruxHistory(rawUrl: string, apiKey: string, { scope, formFactors, onNoData }?: {
    scope?: "origin" | "page";
    formFactors?: CruxFormFactor[];
    onNoData?: (formFactor: CruxFormFactor, message: string) => void;
}): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchWriteResult[]>}
 */
export function runCruxHistoryBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    formFactors?: CruxFormFactor[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxHistoryBatchWriteResult[]>;
/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */
/**
 * @typedef {import('./crux').CruxFormFactor} CruxFormFactor
 *
 * @typedef {chromeuxreport_v1.Schema$HistoryRecord & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   formFactor: CruxFormFactor|null,
 *   url: string,
 *   extractedAt: string
 * }} CruxHistoryReport
 *
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxHistoryReport|null, error: string|null }} CruxHistoryBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, error: string|null }} CruxHistoryBatchWriteResult
 */
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactor?: CruxFormFactor }} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
export function runCruxHistoryAudit(rawUrl: string, apiKey: string, { scope, formFactor }?: {
    scope?: "origin" | "page";
    formFactor?: CruxFormFactor;
}): Promise<CruxHistoryReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
export function runCruxHistoryAuditBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    formFactors?: CruxFormFactor[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxHistoryBatchResult[]>;
export const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND: 2.5;
import { CRUX_FORM_FACTORS } from "./crux";
import { DEFAULT_CRUX_FORM_FACTORS } from "./crux";
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
export { CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS };
