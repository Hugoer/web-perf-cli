export type CruxFormFactor = "phone" | "desktop" | "tablet";
export type CruxClientConfig = {
    /**
     * - full REST endpoint for the query
     */
    endpoint: string;
    /**
     * - results subdirectory and filename prefix
     */
    command: string;
    /**
     * - name used in error messages ("CrUX", "CrUX history")
     */
    dataLabel: string;
    /**
     * - the record field carrying
     * the collection window. queryRecord returns one period; queryHistoryRecord returns many.
     */
    periodKey: "collectionPeriod" | "collectionPeriods";
    /**
     * - request-start cap for batch runs, defaulting to
     * CRUX_MAX_REQUESTS_PER_SECOND. Configurable rather than hard-coded because each module
     * publishes its own quota constant: hard-coding one here left crux-history's exported
     * CRUX_HISTORY_MAX_REQUESTS_PER_SECOND inert, so editing it would have changed nothing.
     */
    maxRequestsPerSecond?: number | undefined;
};
export type CruxAuditOptions = {
    scope?: "origin" | "page";
    formFactor?: CruxFormFactor;
};
export type CruxRunOptions = {
    scope?: "origin" | "page";
    formFactors?: CruxFormFactor[];
    onNoData?: (formFactor: CruxFormFactor, message: string) => void;
};
export type CruxBatchOptions = {
    scope?: "origin" | "page" | undefined;
    concurrency?: number | undefined;
    delayMs?: number | undefined;
    formFactors?: CruxFormFactor[] | undefined;
    onProgress?: ((completed: number, total: number, url: string, error: string | null, statusCode: number | null) => void) | undefined;
};
/**
 * @typedef {'phone'|'desktop'|'tablet'} CruxFormFactor
 *
 * @typedef {Object} CruxClientConfig
 * @property {string} endpoint - full REST endpoint for the query
 * @property {string} command - results subdirectory and filename prefix
 * @property {string} dataLabel - name used in error messages ("CrUX", "CrUX history")
 * @property {'collectionPeriod'|'collectionPeriods'} periodKey - the record field carrying
 *   the collection window. queryRecord returns one period; queryHistoryRecord returns many.
 * @property {number} [maxRequestsPerSecond] - request-start cap for batch runs, defaulting to
 *   CRUX_MAX_REQUESTS_PER_SECOND. Configurable rather than hard-coded because each module
 *   publishes its own quota constant: hard-coding one here left crux-history's exported
 *   CRUX_HISTORY_MAX_REQUESTS_PER_SECOND inert, so editing it would have changed nothing.
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
 * Builds the four entry points for one CrUX endpoint.
 *
 * `queryRecord` and `queryHistoryRecord` differ only in the endpoint, the results directory,
 * the label used in error messages, and whether a record carries `collectionPeriod` or
 * `collectionPeriods`. Everything else — origin normalisation, treating 404 as no-data,
 * retry, rate limiting, file naming — used to be duplicated line for line across crux.js and
 * crux-history.js, so every fix to that path had to be written twice.
 *
 * @param {CruxClientConfig} config
 */
export function createCruxClient({ endpoint, command, dataLabel, periodKey, maxRequestsPerSecond, }: CruxClientConfig): {
    runAudit: (rawUrl: string, apiKey: string, { scope, formFactor }?: CruxAuditOptions) => Promise<{
        [x: string]: any;
        source: string;
        scope: "origin" | "page";
        formFactor: CruxFormFactor | null;
        url: string;
        extractedAt: string;
        metrics: any;
        key: any;
    }>;
    run: (rawUrl: string, apiKey: string, { scope, formFactors, onNoData }?: CruxRunOptions) => Promise<string[]>;
    runAuditBatch: (urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: CruxBatchOptions) => Promise<{
        data: any;
        url: string;
        formFactor: CruxFormFactor;
        noData: boolean;
        error: string | null;
    }[]>;
    runWriteBatch: (urls: string[], apiKey: string, { scope, concurrency, delayMs, formFactors, onProgress }?: CruxBatchOptions) => Promise<{
        outputPath: string | null;
        url: string;
        formFactor: CruxFormFactor;
        noData: boolean;
        error: string | null;
    }[]>;
};
export const CRUX_MAX_REQUESTS_PER_SECOND: 2.5;
export const CRUX_FORM_FACTORS: readonly ["phone", "desktop", "tablet"];
export const DEFAULT_CRUX_FORM_FACTORS: readonly string[];
