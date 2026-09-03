export type CruxFormFactor = import("./crux-client").CruxFormFactor;
export type CruxReport = chromeuxreport_v1.Schema$Record & {
    source: "crux-api";
    scope: "origin" | "page";
    formFactor: CruxFormFactor | null;
    url: string;
    extractedAt: string;
};
export type CruxMetric = chromeuxreport_v1.Schema$Metric;
export type CruxWorkItem = {
    url: string;
    formFactor: CruxFormFactor;
};
export type CruxBatchResult = {
    url: string;
    formFactor: CruxFormFactor;
    data: CruxReport | null;
    noData: boolean;
    error: string | null;
};
export type CruxBatchWriteResult = {
    url: string;
    formFactor: CruxFormFactor;
    outputPath: string | null;
    noData: boolean;
    error: string | null;
};
export type CruxAuditOptions = import("./crux-client").CruxAuditOptions;
export type CruxRunOptions = import("./crux-client").CruxRunOptions;
export type CruxBatchOptions = import("./crux-client").CruxBatchOptions;
import { buildRequestBody } from "./crux-client";
import { callCruxApi } from "./crux-client";
/**
 * Runs CrUX audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxRunOptions} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
export function runCrux(rawUrl: string, apiKey: string, options?: CruxRunOptions): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxBatchWriteResult[]>}
 */
export function runCruxBatch(urls: string[], apiKey: string, options?: CruxBatchOptions): Promise<CruxBatchWriteResult[]>;
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxAuditOptions} [options]
 * @returns {Promise<CruxReport>}
 */
export function runCruxAudit(rawUrl: string, apiKey: string, options?: CruxAuditOptions): Promise<CruxReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxBatchResult[]>}
 */
export function runCruxAuditBatch(urls: string[], apiKey: string, options?: CruxBatchOptions): Promise<CruxBatchResult[]>;
import { CRUX_MAX_REQUESTS_PER_SECOND } from "./crux-client";
import { CRUX_FORM_FACTORS } from "./crux-client";
import { DEFAULT_CRUX_FORM_FACTORS } from "./crux-client";
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
export { buildRequestBody, callCruxApi, CRUX_MAX_REQUESTS_PER_SECOND, CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS };
