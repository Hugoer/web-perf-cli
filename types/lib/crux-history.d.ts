export type CruxFormFactor = import("./crux-client").CruxFormFactor;
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
    noData: boolean;
    error: string | null;
};
export type CruxHistoryBatchWriteResult = {
    url: string;
    formFactor: CruxFormFactor;
    outputPath: string | null;
    noData: boolean;
    error: string | null;
};
export type CruxAuditOptions = import("./crux-client").CruxAuditOptions;
export type CruxRunOptions = import("./crux-client").CruxRunOptions;
export type CruxBatchOptions = import("./crux-client").CruxBatchOptions;
/**
 * Runs CrUX History audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxRunOptions} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
export function runCruxHistory(rawUrl: string, apiKey: string, options?: CruxRunOptions): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxHistoryBatchWriteResult[]>}
 */
export function runCruxHistoryBatch(urls: string[], apiKey: string, options?: CruxBatchOptions): Promise<CruxHistoryBatchWriteResult[]>;
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxAuditOptions} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
export function runCruxHistoryAudit(rawUrl: string, apiKey: string, options?: CruxAuditOptions): Promise<CruxHistoryReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
export function runCruxHistoryAuditBatch(urls: string[], apiKey: string, options?: CruxBatchOptions): Promise<CruxHistoryBatchResult[]>;
export const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND: 2.5;
import { CRUX_FORM_FACTORS } from "./crux-client";
import { DEFAULT_CRUX_FORM_FACTORS } from "./crux-client";
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
export { CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS };
