const {
    buildRequestBody, callCruxApi, createCruxClient,
    CRUX_MAX_REQUESTS_PER_SECOND, CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS,
} = require('./crux-client');

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

/** @import { chromeuxreport_v1 } from '@googleapis/chromeuxreport' */

/**
 * @typedef {import('./crux-client').CruxFormFactor} CruxFormFactor
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
 * @typedef {{ url: string, formFactor: CruxFormFactor, data: CruxReport|null, noData: boolean, error: string|null }} CruxBatchResult
 * @typedef {{ url: string, formFactor: CruxFormFactor, outputPath: string|null, noData: boolean, error: string|null }} CruxBatchWriteResult
 *
 * @typedef {{ scope?: 'origin'|'page', formFactor?: CruxFormFactor }} CruxAuditOptions
 * @typedef {{ scope?: 'origin'|'page', formFactors?: CruxFormFactor[], onNoData?: (formFactor: CruxFormFactor, message: string) => void }} CruxRunOptions
 */

/**
 * @typedef {Object} CruxBatchOptions
 * @property {'origin'|'page'} [scope]
 * @property {number} [concurrency]
 * @property {number} [delayMs]
 * @property {CruxFormFactor[]} [formFactors]
 * @property {(completed: number, total: number, url: string, error: string|null, statusCode: number|null) => void} [onProgress]
 */

const client = createCruxClient({
    endpoint: CRUX_API_URL,
    command: 'crux',
    dataLabel: 'CrUX',
    periodKey: 'collectionPeriod',
});

// Thin typed wrappers rather than bare re-exports of the client's methods: the factory
// assembles the record with a computed [periodKey], which erases the concrete return type.
// These restate it so the generated .d.ts keeps describing a CrUX record.

/**
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxAuditOptions} [options]
 * @returns {Promise<CruxReport>}
 */
const runCruxAudit = (rawUrl, apiKey, options) => client.runAudit(rawUrl, apiKey, options);

/**
 * Runs CrUX audits for a single URL across one or more form factors and writes each result to disk.
 * @param {string} rawUrl
 * @param {string} apiKey
 * @param {CruxRunOptions} [options]
 * @returns {Promise<string[]>} Output file paths for form factors that had data.
 */
const runCrux = (rawUrl, apiKey, options) => client.run(rawUrl, apiKey, options);

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxBatchResult[]>}
 */
const runCruxAuditBatch = (urls, apiKey, options) => client.runAuditBatch(urls, apiKey, options);

/**
 * @param {string[]} urls
 * @param {string} apiKey
 * @param {CruxBatchOptions} [options]
 * @returns {Promise<CruxBatchWriteResult[]>}
 */
const runCruxBatch = (urls, apiKey, options) => client.runWriteBatch(urls, apiKey, options);

module.exports = {
    buildRequestBody,
    callCruxApi,
    runCrux,
    runCruxBatch,
    runCruxAudit,
    runCruxAuditBatch,
    CRUX_MAX_REQUESTS_PER_SECOND,
    CRUX_FORM_FACTORS,
    DEFAULT_CRUX_FORM_FACTORS,
};
