export type LighthouseAudit = {
    id: string;
    title: string;
    description: string;
    score: number | null;
    scoreDisplayMode: string;
    displayValue?: string | undefined;
    numericValue?: number | undefined;
    numericUnit?: string | undefined;
    details?: unknown;
};
export type LighthouseCategory = {
    id: string;
    title: string;
    description: string;
    score: number | null;
    auditRefs: {
        id: string;
        weight: number;
        group?: string;
    }[];
};
export type LabReport = {
    lighthouseVersion: string;
    requestedUrl: string;
    mainDocumentUrl?: string | undefined;
    finalDisplayedUrl?: string | undefined;
    finalUrl: string;
    fetchTime: string;
    formFactor?: "desktop" | "mobile" | undefined;
    /**
     * - absent unless
     * `stripJsonProps: false` is passed. runLabAudit strips it (with `i18n`) by default, so
     * declaring it required promised consumers a field the default path deletes.
     */
    timing?: {
        total: number;
        breakdown: Record<string, number>;
    } | undefined;
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
    /**
     * Survives stripJsonProps, which drops only `i18n` and `timing`. buildRunSummary reads
     * `environment.benchmarkIndex` from it.
     */
    environment?: {
        benchmarkIndex?: number;
        hostUserAgent?: string;
        networkUserAgent?: string;
    } | undefined;
    /**
     * - present when Lighthouse
     * resolved rather than threw: the page failed to load and the report carries no usable
     * metrics. runLabPlan treats a report with this set as a failed run.
     */
    runtimeError?: {
        code: string;
        message?: string;
    } | undefined;
    /**
     * Also survives stripJsonProps. cleanLabReport hoists formFactor out of it, because
     * Lighthouse 13 moved the field here from the report root.
     */
    configSettings?: {
        [key: string]: unknown;
        formFactor?: "desktop" | "mobile";
    } | undefined;
};
export type LabRun = {
    profile?: string;
    network?: string;
    device?: string;
};
export type LabPlanResult = {
    url: string;
    /**
     * - profile name, or 'custom' for network/device-only runs
     */
    profile: string;
    /**
     * - path of the written report. Also present on a failed run
     * when Lighthouse produced a runtimeError report, which is written as the diagnostic.
     */
    outputPath?: string | undefined;
    /**
     * - present when the run failed
     */
    error?: string | undefined;
};
export type LabPlanContext = {
    url: string;
    profile: string;
    /**
     * - 1-based position in the whole plan
     */
    runIndex: number;
    totalRuns: number;
    /**
     * - 1-based repeat within this (url, profile) pair
     */
    repeat: number;
    /**
     * - total repeats configured
     */
    repeats: number;
};
export type LabPlanHooks = {
    onRunStart?: ((ctx: LabPlanContext) => void) | undefined;
    onRunComplete?: ((ctx: LabPlanContext & {
        outputPath: string;
        report: LabReport;
    }) => void) | undefined;
    onRunError?: ((ctx: LabPlanContext & {
        error: string;
        outputPath?: string;
    }) => void) | undefined;
    onSummary?: ((ctx: {
        url: string;
        profile: string;
        summary: import("./variance").RunSummary;
        summaryPath: string;
    }) => void) | undefined;
};
export type LabPlanControls = {
    /**
     * - collect failures instead of aborting the plan
     */
    continueOnError?: boolean | undefined;
    /**
     * - share one Chrome across every run. Faster, but
     * Lighthouse does not clear DNS caches or socket pools between runs, so later runs start
     * warm and score better than earlier ones purely by position in the plan.
     */
    reuseBrowser?: boolean | undefined;
    /**
     * - audits per (url, profile) pair. Above 1, each run is
     * written with a `-runNN` suffix and the group gets a `.summary.json` variance record.
     */
    repeats?: number | undefined;
    /**
     * - injectable runner (tests)
     */
    _runLab?: ((url: string, opts: object) => Promise<{
        outputPath: string;
        data: LabReport;
    }>) | undefined;
    /**
     * - injectable Chrome launcher (tests)
     */
    _launch?: ((opts: object) => Promise<{
        port: number;
        kill: () => Promise<void>;
    }>) | undefined;
};
/**
 * What runLabToDisk takes: the audit options, plus the flag that writes an AI-friendly copy
 * beside the raw report. `runNumber` is set by runLabPlan itself, not by callers.
 */
export type LabWriteOptions = LabAuditOptions & {
    clean?: boolean;
    runNumber?: number;
};
/**
 * Plan-level controls plus the per-run options forwarded to every audit.
 *
 * runLabPlan destructures the controls and spreads the rest into each runLabToDisk call, so
 * the two halves genuinely are one options object to a caller. Declaring only the controls
 * made the published type reject `skipAudits`, `categories`, `blockedUrlPatterns`,
 * `stripJsonProps`, `clean` and `silent` — every option bin/web-perf.js actually passes.
 *
 * `runNumber` and `port` are excluded because runLabPlan owns both, and a caller-supplied
 * value survives to do damage rather than being overridden:
 *
 * - `runNumber` is only replaced when `repeats > 1`, so passing it to a single-run plan
 *   stamps every report in the plan with the same `-runNN` suffix.
 * - `port` is only replaced when the plan launched its own Chrome, so passing it with
 *   `reuseBrowser: false` shares one browser across every run anyway — the position-dependent
 *   scoring `reuseBrowser` warns about, with none of the warning.
 */
export type LabPlanOptions = LabPlanControls & Omit<LabWriteOptions, "runNumber" | "port">;
export type LabAuditOptions = {
    /**
     * - attach to an already-running Chrome instead of launching one
     */
    port?: number | undefined;
    profile?: string | undefined;
    network?: string | undefined;
    device?: string | undefined;
    skipAudits?: string[] | undefined;
    blockedUrlPatterns?: string[] | undefined;
    categories?: string[] | undefined;
    stripJsonProps?: boolean | undefined;
    silent?: boolean | undefined;
};
export function runLab(url: any, labOptions?: {}): Promise<string>;
/**
 * Runs every (url × run) pair, reporting progress through `hooks` so this module stays
 * free of console output. Extracted from bin/web-perf.js so the iteration, browser
 * lifecycle and error partitioning are reachable from the test suite.
 *
 * @param {string[]} urls
 * @param {LabRun[]} runs - resolved profile/network/device combinations
 * @param {LabPlanOptions} [options] - shared lab options plus plan-level controls
 * @param {LabPlanHooks} [hooks]
 * @returns {Promise<LabPlanResult[]>} one entry per (url × run), in execution order
 */
export function runLabPlan(urls: string[], runs: LabRun[], options?: LabPlanOptions, hooks?: LabPlanHooks): Promise<LabPlanResult[]>;
/**
 * @typedef {Object} LabAuditOptions
 * @property {number} [port] - attach to an already-running Chrome instead of launching one
 * @property {string} [profile]
 * @property {string} [network]
 * @property {string} [device]
 * @property {string[]} [skipAudits]
 * @property {string[]} [blockedUrlPatterns]
 * @property {string[]} [categories]
 * @property {boolean} [stripJsonProps]
 * @property {boolean} [silent]
 */
/**
 * @param {string} url
 * @param {LabAuditOptions} [labOptions]
 * @returns {Promise<LabReport>}
 */
export function runLabAudit(url: string, labOptions?: LabAuditOptions): Promise<LabReport>;
/**
 * Runs one audit and writes it to disk, returning the report alongside its path.
 * `runLab` wraps this to keep its published `Promise<string>` signature; `runLabPlan` uses
 * it directly so summaries can read scores without re-parsing the file it just wrote.
 * @param {string} url
 * @param {LabWriteOptions} [labOptions]
 * @returns {Promise<{ outputPath: string, data: LabReport }>}
 */
export function runLabToDisk(url: string, labOptions?: LabWriteOptions): Promise<{
    outputPath: string;
    data: LabReport;
}>;
/**
 * @typedef {Object} LighthouseAudit
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number|null} score
 * @property {string} scoreDisplayMode
 * @property {string} [displayValue]
 * @property {number} [numericValue]
 * @property {string} [numericUnit]
 * @property {unknown} [details]
 */
/**
 * @typedef {Object} LighthouseCategory
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number|null} score
 * @property {{ id: string, weight: number, group?: string }[]} auditRefs
 */
/**
 * @typedef {Object} LabReport
 * @property {string} lighthouseVersion
 * @property {string} requestedUrl
 * @property {string} [mainDocumentUrl]
 * @property {string} [finalDisplayedUrl]
 * @property {string} finalUrl
 * @property {string} fetchTime
 * @property {'desktop'|'mobile'} [formFactor]
 * @property {{ total: number, breakdown: Record<string, number> }} [timing] - absent unless
 *   `stripJsonProps: false` is passed. runLabAudit strips it (with `i18n`) by default, so
 *   declaring it required promised consumers a field the default path deletes.
 * @property {Record<string, LighthouseCategory>} categories
 * @property {Record<string, LighthouseAudit>} audits
 * @property {{ benchmarkIndex?: number, hostUserAgent?: string, networkUserAgent?: string }} [environment]
 *   Survives stripJsonProps, which drops only `i18n` and `timing`. buildRunSummary reads
 *   `environment.benchmarkIndex` from it.
 * @property {{ code: string, message?: string }} [runtimeError] - present when Lighthouse
 *   resolved rather than threw: the page failed to load and the report carries no usable
 *   metrics. runLabPlan treats a report with this set as a failed run.
 * @property {{ formFactor?: 'desktop'|'mobile', [key: string]: unknown }} [configSettings]
 *   Also survives stripJsonProps. cleanLabReport hoists formFactor out of it, because
 *   Lighthouse 13 moved the field here from the report root.
 */
/**
 * @typedef {{ profile?: string, network?: string, device?: string }} LabRun
 *
 * @typedef {Object} LabPlanResult
 * @property {string} url
 * @property {string} profile - profile name, or 'custom' for network/device-only runs
 * @property {string} [outputPath] - path of the written report. Also present on a failed run
 *   when Lighthouse produced a runtimeError report, which is written as the diagnostic.
 * @property {string} [error] - present when the run failed
 *
 * @typedef {Object} LabPlanContext
 * @property {string} url
 * @property {string} profile
 * @property {number} runIndex - 1-based position in the whole plan
 * @property {number} totalRuns
 * @property {number} repeat - 1-based repeat within this (url, profile) pair
 * @property {number} repeats - total repeats configured
 *
 * @typedef {Object} LabPlanHooks
 * @property {(ctx: LabPlanContext) => void} [onRunStart]
 * @property {(ctx: LabPlanContext & { outputPath: string, report: LabReport }) => void} [onRunComplete]
 * @property {(ctx: LabPlanContext & { error: string, outputPath?: string }) => void} [onRunError]
 * @property {(ctx: { url: string, profile: string, summary: import('./variance').RunSummary, summaryPath: string }) => void} [onSummary]
 *
 * @typedef {Object} LabPlanControls
 * @property {boolean} [continueOnError=false] - collect failures instead of aborting the plan
 * @property {boolean} [reuseBrowser=false] - share one Chrome across every run. Faster, but
 *   Lighthouse does not clear DNS caches or socket pools between runs, so later runs start
 *   warm and score better than earlier ones purely by position in the plan.
 * @property {number} [repeats=1] - audits per (url, profile) pair. Above 1, each run is
 *   written with a `-runNN` suffix and the group gets a `.summary.json` variance record.
 * @property {(url: string, opts: object) => Promise<{ outputPath: string, data: LabReport }>} [_runLab] - injectable runner (tests)
 * @property {(opts: object) => Promise<{ port: number, kill: () => Promise<void> }>} [_launch] - injectable Chrome launcher (tests)
 */
/**
 * What runLabToDisk takes: the audit options, plus the flag that writes an AI-friendly copy
 * beside the raw report. `runNumber` is set by runLabPlan itself, not by callers.
 * @typedef {LabAuditOptions & { clean?: boolean, runNumber?: number }} LabWriteOptions
 */
/**
 * Plan-level controls plus the per-run options forwarded to every audit.
 *
 * runLabPlan destructures the controls and spreads the rest into each runLabToDisk call, so
 * the two halves genuinely are one options object to a caller. Declaring only the controls
 * made the published type reject `skipAudits`, `categories`, `blockedUrlPatterns`,
 * `stripJsonProps`, `clean` and `silent` — every option bin/web-perf.js actually passes.
 *
 * `runNumber` and `port` are excluded because runLabPlan owns both, and a caller-supplied
 * value survives to do damage rather than being overridden:
 *
 * - `runNumber` is only replaced when `repeats > 1`, so passing it to a single-run plan
 *   stamps every report in the plan with the same `-runNN` suffix.
 * - `port` is only replaced when the plan launched its own Chrome, so passing it with
 *   `reuseBrowser: false` shares one browser across every run anyway — the position-dependent
 *   scoring `reuseBrowser` warns about, with none of the warning.
 *
 * @typedef {LabPlanControls & Omit<LabWriteOptions, 'runNumber' | 'port'>} LabPlanOptions
 */
export function buildLighthouseConfig(labOptions: any, profileSettings?: {}): {
    extends: string;
    settings: any;
} | undefined;
/**
 * Builds the filename suffix for a run: the profile name, 'custom' for network/device-only
 * runs, and a `-runNN` tail once a plan repeats the same (url, profile) pair.
 * @param {{ profile?: string, network?: string, device?: string, runNumber?: number }} labOptions
 * @returns {string|undefined}
 */
export function buildRunSuffix(labOptions: {
    profile?: string;
    network?: string;
    device?: string;
    runNumber?: number;
}): string | undefined;
export function writeLabResult(outputPath: any, data: any, labOptions?: {}): void;
/**
 * Writes the variance summary for one repeated (url, profile) pair.
 *
 * The path is derived from the group's FIRST run rather than generated fresh, so the summary
 * carries the timestamp the group started at. Generating it would stamp it with the time the
 * last run finished, making it look like a sibling of the final run instead of the set.
 *
 * @param {string} url
 * @param {string} profile
 * @param {import('./variance').RunSummary} summary
 * @param {string} [firstRunPath] - output path of the group's first successful run
 * @returns {string} the summary file path
 */
export function writeRunSummary(url: string, profile: string, summary: import("./variance").RunSummary, firstRunPath?: string): string;
export const CHROME_FLAGS: readonly string[];
export const DEFAULT_SKIP_AUDITS: readonly string[];
