import { describe, it, expect } from 'vitest';

const {
    selectMedianRun,
    assessStability,
    buildRunSummary,
    BENCHMARK_INDEX_SPREAD_THRESHOLD,
    BENCHMARK_INDEX_FLOOR,
    SUMMARY_METRIC_IDS,
    formatRunLine,
    formatSummaryLine,
    runtimeErrorOf,
} = require('./variance');

/**
 * Minimal report fixture — only the fields variance.js reads.
 * @param {{ score?: number|null, benchmarkIndex?: number|null, metrics?: Record<string, number> }} opts
 */
function report({ score = 0.5, benchmarkIndex = 2500, metrics = {} } = {}) {
    const audits = {};
    for (const [id, numericValue] of Object.entries(metrics)) {
        audits[id] = { numericValue };
    }
    return {
        categories: score === null ? {} : { performance: { score } },
        environment: benchmarkIndex === null ? {} : { benchmarkIndex },
        audits,
    };
}

const run = (opts, outputPath) => ({ report: report(opts), outputPath });

describe('selectMedianRun', () => {
    it('returns the index of the median score for an odd count', () => {
        // 0.69 is the median of this set and sits at index 4
        expect(selectMedianRun([0.56, 0.71, 0.68, 0.70, 0.69])).toBe(4);
    });

    it('returns the LOWER median for an even count so the index names a real run', () => {
        expect(selectMedianRun([0.60, 0.70])).toBe(0);
        expect(selectMedianRun([0.56, 0.71, 0.68, 0.70])).toBe(2); // 0.68
    });

    it('returns 0 for a single score', () => {
        expect(selectMedianRun([0.42])).toBe(0);
    });

    it('returns -1 for an empty or invalid input', () => {
        expect(selectMedianRun([])).toBe(-1);
        expect(selectMedianRun(undefined)).toBe(-1);
    });

    it('always returns an index whose score equals the median value', () => {
        const cases = [
            [0.5, 0.5, 0.5],
            [0.8, 0.5, 0.5],
            [0.56, 0.71, 0.68, 0.70, 0.69],
            [0.1, 0.9],
        ];
        for (const scores of cases) {
            const index = selectMedianRun(scores);
            const sorted = [...scores].sort((a, b) => a - b);
            const expectedValue = sorted[Math.floor((sorted.length - 1) / 2)];
            expect(scores[index], JSON.stringify(scores)).toBe(expectedValue);
        }
    });

    it('does not mutate the input array', () => {
        const scores = [0.9, 0.1, 0.5];
        selectMedianRun(scores);
        expect(scores).toEqual([0.9, 0.1, 0.5]);
    });
});

describe('assessStability', () => {
    it('warns when benchmarkIndex spread exceeds the threshold', () => {
        const result = assessStability([1799, 3010]);
        expect(result.stable).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('1.67x');
        expect(result.warnings[0]).toContain('host was not idle');
    });

    it('warns when any run falls below the absolute floor', () => {
        const result = assessStability([900, 950]);
        expect(result.stable).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('host is slow');
    });

    it('reports stable for a quiet host', () => {
        expect(assessStability([2900, 3000])).toEqual({ stable: true, warnings: [] });
    });

    it('can raise both warnings at once', () => {
        const result = assessStability([800, 3000]);
        expect(result.warnings).toHaveLength(2);
    });

    it('treats a single run as stable — spread is undefined for one sample', () => {
        expect(assessStability([2500])).toEqual({ stable: true, warnings: [] });
    });

    it('still applies the floor to a single run', () => {
        expect(assessStability([500]).stable).toBe(false);
    });

    it('ignores non-finite values and handles an empty set', () => {
        expect(assessStability([])).toEqual({ stable: true, warnings: [] });
        expect(assessStability([null, undefined, NaN])).toEqual({ stable: true, warnings: [] });
    });

    it('sits exactly on the documented thresholds', () => {
        expect(BENCHMARK_INDEX_SPREAD_THRESHOLD).toBe(1.5);
        expect(BENCHMARK_INDEX_FLOOR).toBe(1000);
        // exactly 1.5x is not a warning; just past it is
        expect(assessStability([2000, 3000]).stable).toBe(true);
        expect(assessStability([2000, 3001]).stable).toBe(false);
    });
});

describe('buildRunSummary', () => {
    const RUNS = [
        run({ score: 0.56, benchmarkIndex: 1799 }, '/out/run01.json'),
        run({ score: 0.71, benchmarkIndex: 2950 }, '/out/run02.json'),
        run({ score: 0.68, benchmarkIndex: 2880 }, '/out/run03.json'),
        run({ score: 0.70, benchmarkIndex: 3010 }, '/out/run04.json'),
        run({ score: 0.69, benchmarkIndex: 2940 }, '/out/run05.json'),
    ];

    it('selects the median run and its output path', () => {
        const summary = buildRunSummary(RUNS, { url: 'https://a.example/', profile: 'medium' });
        expect(summary.median).toBe(0.69);
        expect(summary.medianRun).toBe(5);
        expect(summary.medianOutputPath).toBe('/out/run05.json');
    });

    it('records scores in run order and the observed spread', () => {
        const summary = buildRunSummary(RUNS);
        expect(summary.scores).toEqual([0.56, 0.71, 0.68, 0.70, 0.69]);
        expect(summary.spread).toEqual({ min: 0.56, max: 0.71 });
    });

    it('records the benchmarkIndex range and flags an unstable host', () => {
        const summary = buildRunSummary(RUNS);
        expect(summary.benchmarkIndex).toEqual({
            min: 1799,
            max: 3010,
            values: [1799, 2950, 2880, 3010, 2940],
        });
        expect(summary.stability.stable).toBe(false);
    });

    it('carries context and run count through', () => {
        const summary = buildRunSummary(RUNS, { url: 'https://a.example/', profile: 'medium' });
        expect(summary.url).toBe('https://a.example/');
        expect(summary.profile).toBe('medium');
        expect(summary.runs).toBe(5);
        expect(summary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('collects the tracked metrics per run', () => {
        const summary = buildRunSummary([
            run({ metrics: { 'total-blocking-time': 275, 'speed-index': 6869 } }),
            run({ metrics: { 'total-blocking-time': 88, 'speed-index': 3711 } }),
        ]);
        expect(Object.keys(summary.metrics).sort()).toEqual([...SUMMARY_METRIC_IDS].sort());
        expect(summary.metrics['total-blocking-time']).toEqual([275, 88]);
        expect(summary.metrics['speed-index']).toEqual([6869, 3711]);
    });

    it('uses null for a metric a run did not produce', () => {
        const summary = buildRunSummary([
            run({ metrics: { 'total-blocking-time': 275 } }),
            run({ metrics: {} }),
        ]);
        expect(summary.metrics['total-blocking-time']).toEqual([275, null]);
    });

    it('yields a null median when no run carries a performance score', () => {
        const summary = buildRunSummary([
            run({ score: null, benchmarkIndex: 2500 }),
            run({ score: null, benchmarkIndex: 2600 }),
        ]);
        expect(summary.median).toBeNull();
        expect(summary.medianRun).toBeNull();
        expect(summary.medianOutputPath).toBeNull();
        // scores stays parallel to the metrics arrays, holding a null per unscored run
        expect(summary.scores).toEqual([null, null]);
        expect(summary.spread).toBeNull();
        // benchmarkIndex and stability are still reported
        expect(summary.benchmarkIndex.values).toEqual([2500, 2600]);
    });

    it('excludes failed runs from every statistic and lists them under errors', () => {
        const summary = buildRunSummary([
            run({ score: 0.56, benchmarkIndex: 2500 }, '/out/run01.json'),
            { error: 'Chrome crashed' },
            run({ score: 0.70, benchmarkIndex: 2600 }, '/out/run03.json'),
        ]);
        expect(summary.runs).toBe(3);
        expect(summary.scores).toEqual([0.56, 0.70]);
        expect(summary.benchmarkIndex.values).toEqual([2500, 2600]);
        expect(summary.errors).toEqual([{ run: 2, message: 'Chrome crashed' }]);
    });

    it('numbers errors by their position in the original run order', () => {
        const summary = buildRunSummary([
            { error: 'first failed' },
            run({ score: 0.5 }),
            { error: 'third failed' },
        ]);
        expect(summary.errors).toEqual([
            { run: 1, message: 'first failed' },
            { run: 3, message: 'third failed' },
        ]);
    });

    it('maps medianRun to the original run number when earlier runs failed', () => {
        const summary = buildRunSummary([
            { error: 'boom' },
            run({ score: 0.60 }, '/out/run02.json'),
            run({ score: 0.80 }, '/out/run03.json'),
        ]);
        // lower median of [0.60, 0.80] is 0.60 — run 2, not run 1
        expect(summary.medianRun).toBe(2);
        expect(summary.medianOutputPath).toBe('/out/run02.json');
    });

    it('omits the errors key entirely when every run succeeded', () => {
        expect(buildRunSummary(RUNS)).not.toHaveProperty('errors');
    });

    it('handles an empty run list without throwing', () => {
        const summary = buildRunSummary([]);
        expect(summary.runs).toBe(0);
        expect(summary.median).toBeNull();
        expect(summary.scores).toEqual([]);
        expect(summary.benchmarkIndex.values).toEqual([]);
        expect(summary.stability.stable).toBe(true);
    });

    it('does not read or write the filesystem (pure)', () => {
        // A report with no outputPath must still summarise cleanly.
        const summary = buildRunSummary([run({ score: 0.5 })]);
        expect(summary.medianOutputPath).toBeNull();
        expect(summary.median).toBe(0.5);
    });
});

describe('formatRunLine', () => {
    it('renders score as a 0-100 integer alongside benchmarkIndex', () => {
        expect(formatRunLine(report({ score: 0.56, benchmarkIndex: 1799.5 }))).toBe('score 56  bmIdx 1800');
    });

    it('renders n/a when the report carries no performance score', () => {
        expect(formatRunLine(report({ score: null, benchmarkIndex: 2500 }))).toBe('score n/a  bmIdx 2500');
    });

    it('omits benchmarkIndex when it is absent', () => {
        expect(formatRunLine(report({ score: 0.7, benchmarkIndex: null }))).toBe('score 70');
    });
});

describe('formatSummaryLine', () => {
    it('renders median, spread and benchmarkIndex range', () => {
        const summary = buildRunSummary([
            run({ score: 0.56, benchmarkIndex: 1799 }),
            run({ score: 0.71, benchmarkIndex: 3010 }),
            run({ score: 0.69, benchmarkIndex: 2940 }),
        ]);
        expect(formatSummaryLine(summary)).toBe('median 69 · spread 56-71 · bmIdx 1799-3010');
    });

    it('collapses the benchmarkIndex range when every run matched', () => {
        const summary = buildRunSummary([
            run({ score: 0.5, benchmarkIndex: 2500 }),
            run({ score: 0.5, benchmarkIndex: 2500 }),
        ]);
        expect(formatSummaryLine(summary)).toContain('bmIdx 2500');
        expect(formatSummaryLine(summary)).not.toContain('2500-2500');
    });

    it('says median is unavailable without a performance category', () => {
        const summary = buildRunSummary([run({ score: null, benchmarkIndex: 2500 })]);
        expect(formatSummaryLine(summary)).toContain('median n/a (no performance category)');
    });

    it('appends a failure count when runs failed', () => {
        const summary = buildRunSummary([
            run({ score: 0.5, benchmarkIndex: 2500 }),
            { error: 'boom' },
        ]);
        expect(formatSummaryLine(summary)).toContain('1 failed');
    });
});

describe('runtimeErrorOf', () => {
    it('extracts code and message from a failed-load report', () => {
        expect(runtimeErrorOf({
            runtimeError: { code: 'CHROME_INTERSTITIAL_ERROR', message: 'Chrome prevented page load' },
        })).toBe('CHROME_INTERSTITIAL_ERROR: Chrome prevented page load');
    });

    it('falls back to the code alone when there is no message', () => {
        expect(runtimeErrorOf({ runtimeError: { code: 'NO_FCP' } })).toBe('NO_FCP');
    });

    it('returns null for a healthy report', () => {
        expect(runtimeErrorOf(report({ score: 0.9 }))).toBeNull();
        expect(runtimeErrorOf({})).toBeNull();
        expect(runtimeErrorOf(undefined)).toBeNull();
    });
});

describe('buildRunSummary — runtimeError reports', () => {
    // Lighthouse RESOLVES with a report when a page fails to load; without this the run
    // looks like a success that merely lacks a performance category, and a summary would
    // claim "median n/a" instead of reporting that nothing loaded.
    const failedLoad = {
        runtimeError: { code: 'CHROME_INTERSTITIAL_ERROR', message: 'Chrome prevented page load' },
        categories: {},
        environment: { benchmarkIndex: 1800 },
        audits: {},
    };

    it('counts a runtimeError report as a failed run, not a scoreless success', () => {
        const summary = buildRunSummary([{ report: failedLoad, outputPath: '/o/run01.json' }]);
        expect(summary.errors).toEqual([
            { run: 1, message: 'CHROME_INTERSTITIAL_ERROR: Chrome prevented page load' },
        ]);
        expect(summary.scores).toEqual([]);
        expect(summary.median).toBeNull();
    });

    it('excludes its benchmarkIndex and metrics from the statistics', () => {
        const summary = buildRunSummary([
            { report: failedLoad, outputPath: '/o/run01.json' },
            run({ score: 0.8, benchmarkIndex: 2500 }, '/o/run02.json'),
        ]);
        // 1800 came from the failed load and must not widen the reported range
        expect(summary.benchmarkIndex.values).toEqual([2500]);
        expect(summary.scores).toEqual([0.8]);
        expect(summary.medianRun).toBe(2);
    });

    it('numbers a runtimeError failure by its position in the run order', () => {
        const summary = buildRunSummary([
            run({ score: 0.8 }),
            { report: failedLoad },
            run({ score: 0.9 }),
        ]);
        expect(summary.errors).toEqual([
            { run: 2, message: 'CHROME_INTERSTITIAL_ERROR: Chrome prevented page load' },
        ]);
        expect(summary.runs).toBe(3);
    });
});

describe('buildRunSummary — array alignment', () => {
    it('keeps scores index-aligned with every metrics array', () => {
        const summary = buildRunSummary([
            run({ score: 0.5, metrics: { 'total-blocking-time': 100 } }),
            run({ score: null, metrics: { 'total-blocking-time': 200 } }),
            run({ score: 0.7, metrics: { 'total-blocking-time': 300 } }),
        ]);
        expect(summary.scores).toEqual([0.5, null, 0.7]);
        for (const id of SUMMARY_METRIC_IDS) {
            expect(summary.metrics[id], id).toHaveLength(summary.scores.length);
        }
        // index 1 is the same run in both arrays
        expect(summary.metrics['total-blocking-time'][1]).toBe(200);
    });

    it('excludes the nulls from median and spread', () => {
        const summary = buildRunSummary([
            run({ score: 0.9 }),
            run({ score: null }),
            run({ score: 0.5 }),
        ]);
        expect(summary.median).toBe(0.5);
        expect(summary.spread).toEqual({ min: 0.5, max: 0.9 });
        expect(summary.medianRun).toBe(3);
    });

    it('drops failed runs from the arrays entirely rather than holing them', () => {
        // a failed run has no metrics to align, so it is only in `errors`
        const summary = buildRunSummary([run({ score: 0.5 }), { error: 'boom' }]);
        expect(summary.scores).toEqual([0.5]);
        expect(summary.metrics['total-blocking-time']).toHaveLength(1);
        expect(summary.errors).toEqual([{ run: 2, message: 'boom' }]);
    });
});
