// Run-to-run variance analysis for repeated lab audits.
//
// Lighthouse's Lantern simulator re-times an unthrottled trace: it multiplies OBSERVED CPU
// task durations by cpuSlowdownMultiplier without normalising for how fast the host was at
// the time, and adds each origin's OBSERVED server latency on top of the simulated RTT. A
// busy machine or a cold connection pool therefore lands directly in the score. Lighthouse
// reports `environment.benchmarkIndex` (a CPU benchmark taken per run) but does not act on
// it. These helpers turn a set of repeated runs into a median plus an explicit record of how
// much the host moved, so a score can be read alongside its own trustworthiness.
//
// Pure functions only: no fs, no Lighthouse, no browser. Callers own all I/O.

// A genuinely idle machine holds benchmarkIndex within roughly 10-15% across runs, so a 50%
// spread means something else was competing for CPU. Below the floor, the host is slow enough
// that scores stop being comparable to reference hardware at all.
const BENCHMARK_INDEX_SPREAD_THRESHOLD = 1.5;
const BENCHMARK_INDEX_FLOOR = 1000;

// Metrics tracked per run in the summary. These are the five that carry the performance
// score's weight (10/25/30/25/10 in Lighthouse v10+ scoring).
const SUMMARY_METRIC_IDS = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
];

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
 * @property {Array<number|null>} scores - one entry per successful run, in run order and
 *   index-aligned with every `metrics` array. null where the run carried no performance
 *   category. `median` and `spread` ignore the nulls.
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
function selectMedianRun(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
        return -1;
    }
    const ordered = scores
        .map((score, index) => ({ score, index }))
        .sort((a, b) => a.score - b.score || a.index - b.index);
    // (length - 1) / 2 floors to the lower of the two middles on even counts.
    return ordered[Math.floor((ordered.length - 1) / 2)].index;
}

/**
 * Flags host conditions that make repeated scores incomparable.
 * @param {Array<number|null|undefined>} benchmarkIndexes
 * @returns {StabilityAssessment}
 */
function assessStability(benchmarkIndexes) {
    const values = (benchmarkIndexes || []).filter((v) => Number.isFinite(v));
    const warnings = [];
    if (values.length === 0) {
        return { stable: true, warnings };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (values.length > 1 && min > 0 && max / min > BENCHMARK_INDEX_SPREAD_THRESHOLD) {
        warnings.push(
            `benchmarkIndex varied ${(max / min).toFixed(2)}x across runs (${Math.round(min)}-${Math.round(max)}) — host was not idle`,
        );
    }
    if (min < BENCHMARK_INDEX_FLOOR) {
        warnings.push(
            `benchmarkIndex fell to ${Math.round(min)} (below ${BENCHMARK_INDEX_FLOOR}) — host is slow; scores are not comparable to reference hardware`,
        );
    }

    return { stable: warnings.length === 0, warnings };
}

/**
 * @param {object} report
 * @returns {number|null}
 */
function performanceScore(report) {
    const score = report && report.categories && report.categories.performance
        ? report.categories.performance.score
        : undefined;
    return Number.isFinite(score) ? score : null;
}

/**
 * @param {object} report
 * @returns {number|null}
 */
function benchmarkIndexOf(report) {
    const value = report && report.environment ? report.environment.benchmarkIndex : undefined;
    return Number.isFinite(value) ? value : null;
}

/**
 * Lighthouse does not throw when a page fails to load — it RESOLVES with a report carrying
 * `runtimeError` (CHROME_INTERSTITIAL_ERROR, NO_FCP, DNS_FAILURE, ...) and no usable metrics.
 * Such a run is a failure, not a run that merely lacks a performance category, and must not
 * be averaged into a median.
 * @param {object} report
 * @returns {string|null} "CODE: message", or null when the run loaded normally
 */
function runtimeErrorOf(report) {
    const runtimeError = report && report.runtimeError;
    if (!runtimeError || !runtimeError.code) {
        return null;
    }
    return runtimeError.message ? `${runtimeError.code}: ${runtimeError.message}` : runtimeError.code;
}

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
function buildRunSummary(runs, context = {}) {
    const attempted = Array.isArray(runs) ? runs : [];
    const succeeded = [];
    const errors = [];

    attempted.forEach((run, index) => {
        if (!run) {
            return;
        }
        // A report carrying runtimeError is a failed load, even though the caller received it
        // as a resolved value rather than a thrown error.
        const failure = run.error || runtimeErrorOf(run.report);
        if (failure) {
            errors.push({ run: index + 1, message: failure });
        } else {
            succeeded.push({ ...run, run: index + 1 });
        }
    });

    // scores is parallel to `succeeded` (and therefore to every metrics array), so index i
    // is the same run everywhere in the summary. A run that loaded but carries no
    // performance category holds a null and cannot be the median.
    const scores = succeeded.map((r) => performanceScore(r.report));
    // Both filters run over the same predicate in the same order, so `scored` and
    // `scoredValues` stay index-aligned with each other and medianIndex addresses both.
    const scored = succeeded.filter((_, i) => scores[i] !== null);
    const scoredValues = scores.filter((score) => score !== null);
    const medianIndex = selectMedianRun(scoredValues);
    const hasMedian = medianIndex !== -1;

    const benchmarkValues = succeeded
        .map((r) => benchmarkIndexOf(r.report))
        .filter((v) => v !== null);

    const metrics = {};
    for (const id of SUMMARY_METRIC_IDS) {
        metrics[id] = succeeded.map((r) => {
            const audit = r.report && r.report.audits ? r.report.audits[id] : undefined;
            return audit && Number.isFinite(audit.numericValue) ? audit.numericValue : null;
        });
    }

    const summary = {
        url: context.url || null,
        profile: context.profile || null,
        runs: attempted.length,
        medianRun: hasMedian ? scored[medianIndex].run : null,
        medianOutputPath: hasMedian ? scored[medianIndex].outputPath || null : null,
        scores,
        median: hasMedian ? scoredValues[medianIndex] : null,
        spread: scoredValues.length > 0
            ? { min: Math.min(...scoredValues), max: Math.max(...scoredValues) }
            : null,
        benchmarkIndex: {
            min: benchmarkValues.length > 0 ? Math.min(...benchmarkValues) : null,
            max: benchmarkValues.length > 0 ? Math.max(...benchmarkValues) : null,
            values: benchmarkValues,
        },
        metrics,
        stability: assessStability(benchmarkValues),
        generatedAt: new Date().toISOString(),
    };

    if (errors.length > 0) {
        summary.errors = errors;
    }
    return summary;
}

/**
 * One-line rendering of a single run: `score 56  bmIdx 1799`.
 * @param {object} report - raw Lighthouse report
 * @returns {string}
 */
function formatRunLine(report) {
    const score = performanceScore(report);
    const benchmarkIndex = benchmarkIndexOf(report);
    const parts = [`score ${score === null ? 'n/a' : Math.round(score * 100)}`];
    if (benchmarkIndex !== null) {
        parts.push(`bmIdx ${Math.round(benchmarkIndex)}`);
    }
    return parts.join('  ');
}

/**
 * One-line rendering of a group: `median 69 · spread 56-71 · bmIdx 1799-3010`.
 * @param {RunSummary} summary
 * @returns {string}
 */
function formatSummaryLine(summary) {
    const parts = [];
    const pct = (n) => Math.round(n * 100);

    if (summary.median === null) {
        parts.push('median n/a (no performance category)');
    } else {
        parts.push(`median ${pct(summary.median)}`);
    }
    if (summary.spread) {
        parts.push(`spread ${pct(summary.spread.min)}-${pct(summary.spread.max)}`);
    }
    if (summary.benchmarkIndex.min !== null) {
        const { min, max } = summary.benchmarkIndex;
        parts.push(`bmIdx ${Math.round(min)}${min === max ? '' : `-${Math.round(max)}`}`);
    }
    if (summary.errors) {
        parts.push(`${summary.errors.length} failed`);
    }
    return parts.join(' · ');
}

module.exports = {
    selectMedianRun,
    assessStability,
    buildRunSummary,
    runtimeErrorOf,
    formatRunLine,
    formatSummaryLine,
    BENCHMARK_INDEX_SPREAD_THRESHOLD,
    BENCHMARK_INDEX_FLOOR,
    SUMMARY_METRIC_IDS,
};
