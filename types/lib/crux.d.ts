export type CruxFormFactor = "phone" | "desktop" | "tablet";
export type CruxReport = chromeuxreport_v1.Schema$Record & {
    source: "crux-api";
    scope: "origin" | "page";
    formFactor: CruxFormFactor | null;
    url: string;
    extractedAt: string;
};
export type CruxWorkItem = {
    url: string;
    formFactor: CruxFormFactor;
};
export type CruxBatchResult = {
    url: string;
    formFactor: CruxFormFactor;
    data: CruxReport | null;
    error: string | null;
};
export type CruxBatchWriteResult = {
    url: string;
    formFactor: CruxFormFactor;
    outputPath: string | null;
    error: string | null;
};
/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */
/**
 * @typedef {'phone'|'desktop'|'tablet'} CruxFormFactor
 *
 * @typedef {chromeuxreport_v1.Schema$Record & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   formFactor: CruxFormFactor|null,
 *   url: string,
 *   extractedAt: string
 * }} CruxReport
 *
 * @typedef {{ url: string, formFactor: CruxFormFactor }} CruxWorkItem
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxReport|null, error: string|null }} CruxBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, error: string|null }} CruxBatchWriteResult
 */
/**
 * @param {string} url
 * @param {'origin'|'page'} scope
 * @param {CruxFormFactor} [formFactor]
 */
export function buildRequestBody(url: string, scope: "origin" | "page", formFactor?: CruxFormFactor): {
    origin: string;
    url?: undefined;
} | {
    url: string;
    origin?: undefined;
};
export function callCruxApi(endpointUrl: any, body: any, apiKey: any, { scope, dataLabel }?: {
    scope?: string | undefined;
    dataLabel?: string | undefined;
}): Promise<any>;
/**
 * Runs CrUX audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactors?: CruxFormFactor[], onNoData?: (formFactor: CruxFormFactor, message: string) => void }} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
export function runCrux(rawUrl: string, apiKey: string, { scope, formFactors, onNoData }?: {
    scope?: "origin" | "page";
    formFactors?: CruxFormFactor[];
    onNoData?: (formFactor: CruxFormFactor, message: string) => void;
}): Promise<string[]>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxBatchWriteResult[]>}
 */
export function runCruxBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    formFactors?: CruxFormFactor[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxBatchWriteResult[]>;
/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', formFactor?: CruxFormFactor }} [options]
 * @returns {Promise<CruxReport>}
 */
export function runCruxAudit(rawUrl: string, apiKey: string, { scope, formFactor }?: {
    scope?: "origin" | "page";
    formFactor?: CruxFormFactor;
}): Promise<CruxReport>;
/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {{ scope?: 'origin'|'page', concurrency?: number, delayMs?: number, formFactors?: CruxFormFactor[], onProgress?: (completed: number, total: number, url: string, error: string|null) => void }} [options]
 * @returns {Promise<CruxBatchResult[]>}
 */
export function runCruxAuditBatch(urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: {
    scope?: "origin" | "page";
    concurrency?: number;
    delayMs?: number;
    formFactors?: CruxFormFactor[];
    onProgress?: (completed: number, total: number, url: string, error: string | null) => void;
}): Promise<CruxBatchResult[]>;
export const CRUX_MAX_REQUESTS_PER_SECOND: 2.5;
export const CRUX_FORM_FACTORS: readonly ["phone", "desktop", "tablet"];
export const DEFAULT_CRUX_FORM_FACTORS: string[];
import type { chromeuxreport_v1 } from '@googleapis/chromeuxreport';
