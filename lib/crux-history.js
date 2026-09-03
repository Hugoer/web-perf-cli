const { createCruxClient, CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS } = require('./crux-client');

const CRUX_HISTORY_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';
const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND = 2.5;

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {import('./crux-client').CruxFormFactor} CruxFormFactor
 *
 * @typedef {chromeuxreport_v1.Schema$HistoryRecord & {
 *   source: 'crux-api',
 *   scope: 'origin' | 'page',
 *   formFactor: CruxFormFactor|null,
 *   url: string,
 *   extractedAt: string
 * }} CruxHistoryReport
 *
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxHistoryReport|null, noData: boolean, error: string|null }} CruxHistoryBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, noData: boolean, error: string|null }} CruxHistoryBatchWriteResult
 *
 * @typedef {import('./crux').CruxAuditOptions} CruxAuditOptions
 * @typedef {import('./crux').CruxRunOptions} CruxRunOptions
 * @typedef {import('./crux').CruxBatchOptions} CruxBatchOptions
 */

const client = createCruxClient({
    endpoint: CRUX_HISTORY_API_URL,
    command: 'crux-history',
    dataLabel: 'CrUX history',
    periodKey: 'collectionPeriods',
    maxRequestsPerSecond: CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
});

// See the note in crux.js: these wrappers exist to restate the concrete record type that the
// factory's computed [periodKey] erases.

/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxAuditOptions} [options]
 * @returns {Promise<CruxHistoryReport>}
 */
const runCruxHistoryAudit = (rawUrl, apiKey, options) => client.runAudit(rawUrl, apiKey, options);

/**
 * Runs CrUX History audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxRunOptions} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
const runCruxHistory = (rawUrl, apiKey, options) => client.run(rawUrl, apiKey, options);

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxHistoryBatchResult[]>}
 */
const runCruxHistoryAuditBatch = (urls, apiKey, options) => client.runAuditBatch(urls, apiKey, options);

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxHistoryBatchWriteResult[]>}
 */
const runCruxHistoryBatch = (urls, apiKey, options) => client.runWriteBatch(urls, apiKey, options);

module.exports = {
    runCruxHistory,
    runCruxHistoryBatch,
    runCruxHistoryAudit,
    runCruxHistoryAuditBatch,
    CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
    CRUX_FORM_FACTORS,
    DEFAULT_CRUX_FORM_FACTORS,
};
