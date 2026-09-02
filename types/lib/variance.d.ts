export type VarianceRun = {
    /**
     * - raw Lighthouse report; absent when the run failed. A report
     * carrying `runtimeError` counts as a failure even though it was resolved, not thrown.
     */
    report?: object | undefined;
    /**
     * - where the report was written
     */
    outputPath?: string | undefined;
    /**
     * - failure message; absent when the run succeeded
     */
    error?: string | undefined;
};
export type StabilityAssessment = {
    stable: boolean;
    warnings: string[];
};
export type RunSummary = {
    /**
     * - null when no context was supplied
     */
    url: string | null;
    /**
     * - null when no context was supplied
     */
    profile: string | null;
    /**
     * - runs attempted, including failures
     */
    runs: number;
    /**
     * - 1-based index of the median run, null when unscored
     */
    medianRun: number | null;
    medianOutputPath: string | null;
    /**
     * - performance scores, in run order, successful runs only
     */
    scores: number[];
    median: number | null;
    spread: {
        min: number;
        max: number;
    } | null;
    benchmarkIndex: {
        min: number | null;
        max: number | null;
        values: number[];
    };
    metrics: Record<string, Array<number | null>>;
    stability: StabilityAssessment;
    errors?: {
        run: number;
        message: string;
    }[] | undefined;
    generatedAt: string;
};
/**
 * @typedef {Object} VarianceRun
 * @property {object} [report] - raw Lighthouse report; absent when the run failed. A report
 *   carrying `runtimeError` counts as a failure even though it was resolved, not thrown.
 * @property {string} [outputPath] - where the report was written
 * @property {string} [error] - failure message; absent when the run succeeded
 *
 * @typedef {Object} StabilityAssessment
 * @property {boolean} stable
 * @property {string[]} warnings
 *
 * @typedef {Object} RunSummary
 * @property {string|null} url - null when no context was supplied
 * @property {string|null} profile - null when no context was supplied
 * @property {number} runs - runs attempted, including failures
 * @property {number|null} medianRun - 1-based index of the median run, null when unscored
 * @property {string|null} medianOutputPath
 * @property {number[]} scores - performance scores, in run order, successful runs only
 * @property {number|null} median
 * @property {{ min: number, max: number }|null} spread
 * @property {{ min: number|null, max: number|null, values: number[] }} benchmarkIndex
 * @property {Record<string, Array<number|null>>} metrics
 * @property {StabilityAssessment} stability
 * @property {Array<{ run: number, message: string }>} [errors]
 * @property {string} generatedAt
 */
/**
 * Picks the run whose score is the median. For an even count the LOWER median is returned,
 * so the result always identifies a run that actually happened (and therefore a file that
 * actually exists) rather than an interpolated value between two runs.
 * @param {number[]} scores
 * @returns {number} zero-based index into `scores`, or -1 when `scores` is empty
 */
export function selectMedianRun(scores: number[]): number;
/**
 * Flags host conditions that make repeated scores incomparable.
 * @param {Array<number|null|undefined>} benchmarkIndexes
 * @returns {StabilityAssessment}
 */
export function assessStability(benchmarkIndexes: Array<number | null | undefined>): StabilityAssessment;
/**
 * Reduces a set of repeated runs to a median selection plus a variance record.
 *
 * Runs that failed are excluded from every statistic and listed under `errors` — including
 * runs whose report carries `runtimeError`, which Lighthouse resolves rather than throws. A
 * run that loaded fine but carries no performance score (e.g. `--category=accessibility`)
 * still contributes its benchmarkIndex and metrics but cannot be the median.
 *
 * @param {VarianceRun[]} runs - in execution order
 * @param {{ url?: string, profile?: string }} [context]
 * @returns {RunSummary}
 */
export function buildRunSummary(runs: VarianceRun[], context?: {
    url?: string;
    profile?: string;
}): RunSummary;
/**
 * Lighthouse does not throw when a page fails to load — it RESOLVES with a report carrying
 * `runtimeError` (CHROME_INTERSTITIAL_ERROR, NO_FCP, DNS_FAILURE, ...) and no usable metrics.
 * Such a run is a failure, not a run that merely lacks a performance category, and must not
 * be averaged into a median.
 * @param {object} report
 * @returns {string|null} "CODE: message", or null when the run loaded normally
 */
export function runtimeErrorOf(report: object): string | null;
/**
 * One-line rendering of a single run: `score 56  bmIdx 1799`.
 * @param {object} report - raw Lighthouse report
 * @returns {string}
 */
export function formatRunLine(report: object): string;
/**
 * One-line rendering of a group: `median 69 · spread 56-71 · bmIdx 1799-3010`.
 * @param {RunSummary} summary
 * @returns {string}
 */
export function formatSummaryLine(summary: RunSummary): string;
export const BENCHMARK_INDEX_SPREAD_THRESHOLD: 1.5;
export const BENCHMARK_INDEX_FLOOR: 1000;
export const SUMMARY_METRIC_IDS: string[];
