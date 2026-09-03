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
export function createCruxClient({ endpoint, command, dataLabel, periodKey }: CruxClientConfig): {
    runAudit: (rawUrl: any, apiKey: any, { scope, formFactor }?: {
        scope?: string | undefined;
    }) => Promise<{
        [x: string]: any;
        source: string;
        scope: string;
        formFactor: any;
        url: any;
        extractedAt: string;
        metrics: any;
        key: any;
    }>;
    run: (rawUrl: any, apiKey: any, { scope, formFactors, onNoData }?: {
        scope?: string | undefined;
        formFactors?: string[] | undefined;
    }) => Promise<string[]>;
    runAuditBatch: (urls: any, apiKey: any, { scope, concurrency, delayMs, formFactors, onProgress }?: {
        scope?: string | undefined;
        concurrency?: number | undefined;
        delayMs?: number | undefined;
        formFactors?: string[] | undefined;
    }) => Promise<{
        data: any;
        url: string;
        formFactor: CruxFormFactor;
        noData: boolean;
        error: string | null;
    }[]>;
    runWriteBatch: (urls: any, apiKey: any, { scope, concurrency, delayMs, formFactors, onProgress }?: {
        scope?: string | undefined;
        concurrency?: number | undefined;
        delayMs?: number | undefined;
        formFactors?: string[] | undefined;
    }) => Promise<{
        outputPath: string | null;
        url: string;
        formFactor: CruxFormFactor;
        noData: boolean;
        error: string | null;
    }[]>;
};
export const CRUX_MAX_REQUESTS_PER_SECOND: 2.5;
export const CRUX_FORM_FACTORS: readonly ["phone", "desktop", "tablet"];
export const DEFAULT_CRUX_FORM_FACTORS: string[];
