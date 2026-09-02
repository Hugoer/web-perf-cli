import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// No vi.mock here on purpose. This suite loads modules with require(), which goes through
// Node's CJS loader and bypasses the test runner's module graph, so vi.mock() cannot reach
// lab.js's dependencies — two such calls lived here for a long time without ever taking
// effect. Use the injection seams instead: runLabPlan takes `_runLab` / `_launch`, mirroring
// the `_sleep` seam in withRetry. The runLabAudit tests below avoid Chrome by passing an
// explicit `port`, not by mocking chrome-launcher.

const fs = require('fs');

const {
    DEFAULT_SKIP_AUDITS, buildLighthouseConfig, buildRunSuffix, runLab, runLabPlan, runLabAudit,
    writeLabResult, writeRunSummary,
} = require('./lab');
const { SKIPPABLE_AUDITS } = require('./prompts');
const utils = require('./utils');

describe('DEFAULT_SKIP_AUDITS', () => {
    it('should contain the expected default audit IDs', () => {
        expect(DEFAULT_SKIP_AUDITS).toEqual([
            'full-page-screenshot',
            'screenshot-thumbnails',
            'final-screenshot',
            'valid-source-maps',
        ]);
    });

    it('should match all SKIPPABLE_AUDITS entries with defaultSkip: true', () => {
        const expectedDefaults = SKIPPABLE_AUDITS.filter((a) => a.defaultSkip).map((a) => a.id);
        expect(DEFAULT_SKIP_AUDITS).toEqual(expectedDefaults);
    });
});

describe('SKIPPABLE_AUDITS', () => {
    it('should have unique IDs', () => {
        const ids = SKIPPABLE_AUDITS.map((a) => a.id);
        expect(ids).toEqual([...new Set(ids)]);
    });

    it('should have required fields on every entry', () => {
        for (const audit of SKIPPABLE_AUDITS) {
            expect(audit).toHaveProperty('id');
            expect(audit).toHaveProperty('label');
            expect(audit).toHaveProperty('defaultSkip');
            expect(typeof audit.id).toBe('string');
            expect(typeof audit.label).toBe('string');
            expect(typeof audit.defaultSkip).toBe('boolean');
        }
    });
});

describe('runLab Lighthouse config', () => {
    it('translates full-page-screenshot to disableFullPageScreenshot: true', () => {
        const config = buildLighthouseConfig({
            skipAudits: ['full-page-screenshot', 'screenshot-thumbnails'],
        });
        expect(config.settings.disableFullPageScreenshot).toBe(true);
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails']);
        expect(config.settings.skipAudits).not.toContain('full-page-screenshot');
    });

    it('does not set disableFullPageScreenshot when full-page-screenshot is absent', () => {
        const config = buildLighthouseConfig({
            skipAudits: ['screenshot-thumbnails', 'final-screenshot'],
        });
        expect(config.settings.disableFullPageScreenshot).toBeUndefined();
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails', 'final-screenshot']);
    });

    it('applies disableFullPageScreenshot via DEFAULT_SKIP_AUDITS', () => {
        const config = buildLighthouseConfig({});
        expect(config.settings.disableFullPageScreenshot).toBe(true);
        expect(config.settings.skipAudits).not.toContain('full-page-screenshot');
    });
});

describe('runLab Lighthouse config — category filtering', () => {
    it('sets onlyCategories for a proper subset', () => {
        const config = buildLighthouseConfig({ categories: ['performance', 'seo'] });
        expect(config.settings.onlyCategories).toEqual(['performance', 'seo']);
    });

    it('sets onlyCategories when filtering to a single category (agentic-browsing)', () => {
        const config = buildLighthouseConfig({ categories: ['agentic-browsing'] });
        expect(config.settings.onlyCategories).toEqual(['agentic-browsing']);
    });

    it('omits onlyCategories when all five categories are selected (Lighthouse default)', () => {
        const config = buildLighthouseConfig({
            categories: ['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing'],
        });
        expect(config.settings.onlyCategories).toBeUndefined();
    });

    it('omits onlyCategories when categories is empty or undefined', () => {
        expect(buildLighthouseConfig({ categories: [] }).settings.onlyCategories).toBeUndefined();
        expect(buildLighthouseConfig({}).settings.onlyCategories).toBeUndefined();
    });

    it('composes onlyCategories with profile settings and skipAudits', () => {
        const config = buildLighthouseConfig(
            { categories: ['performance'], skipAudits: ['screenshot-thumbnails'] },
            { formFactor: 'desktop' },
        );
        expect(config.settings.onlyCategories).toEqual(['performance']);
        expect(config.settings.formFactor).toBe('desktop');
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails']);
    });
});

describe('runLabAudit — I/O isolation', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is exported from the module', () => {
        expect(typeof runLabAudit).toBe('function');
    });

    it('does NOT call fs.writeFileSync (pure — no disk I/O)', async () => {
        const spy = vi.spyOn(fs, 'writeFileSync');
        // port: 9999 skips Chrome launch; lighthouse fails in ~800ms — fast & deterministic
        await expect(runLabAudit('https://example.com', { port: 9999 })).rejects.toThrow();
        expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT call ensureCommandDir (no CLI setup)', async () => {
        const spy = vi.spyOn(utils, 'ensureCommandDir');
        await expect(runLabAudit('https://example.com', { port: 9999 })).rejects.toThrow();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('runLab — regression (CLI wrapper)', () => {
    it('is exported from the module', () => {
        expect(typeof runLab).toBe('function');
    });
});

describe('writeLabResult — --clean flag', () => {
    const RAW_PATH = '/tmp/results/lab/lab-example.com-2024-01-01-120000.json';
    const MOCK_DATA = { requestedUrl: 'https://example.com', audits: {} };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('writes only raw file when clean is not set', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, {});
        expect(fsSpy).toHaveBeenCalledOnce();
    });

    it('writes raw and clean files when clean: true', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        expect(fsSpy).toHaveBeenCalledTimes(2);
        const cleanCall = fsSpy.mock.calls.find((c) => c[0].includes('clean'));
        expect(cleanCall).toBeDefined();
        expect(cleanCall[0]).toMatch(/\.clean\.json$/);
        const written = JSON.parse(cleanCall[1]);
        expect(written._clean).toBe(true);
    });

    it('clean output path is under a clean/ subfolder of the raw output dir', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        const rawCall = fsSpy.mock.calls.find((c) => !c[0].includes('clean'));
        const cleanCall = fsSpy.mock.calls.find((c) => c[0].includes('clean'));
        const rawDir = require('path').dirname(rawCall[0]);
        const cleanDir = require('path').dirname(cleanCall[0]);
        expect(cleanDir).toBe(require('path').join(rawDir, 'clean'));
    });

    it('creates clean/ dir before writing', () => {
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        const cleanDir = require('path').join(require('path').dirname(RAW_PATH), 'clean');
        expect(mkdirSpy).toHaveBeenCalledWith(cleanDir, { recursive: true });
    });
});

describe('runLabPlan — iteration and browser lifecycle', () => {
    const RUNS = [{ profile: 'low' }, { profile: 'high' }];
    const URLS = ['https://a.example', 'https://b.example'];

    let runLabSpy;
    let mockLaunch;
    let killSpy;

    // `_runLab` / `_launch` are the seams runLabPlan exposes: lib modules are loaded with
    // require(), so vi.mock() cannot reach their dependencies.
    const plan = (urls, runs, options = {}, hooks = {}) => runLabPlan(
        urls,
        runs,
        { _runLab: runLabSpy, _launch: mockLaunch, ...options },
        hooks,
    );

    beforeEach(() => {
        killSpy = vi.fn();
        mockLaunch = vi.fn().mockResolvedValue({ port: 9999, kill: killSpy });
        runLabSpy = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('runs every (url x run) pair, URL-major and run-minor', async () => {
        runLabSpy.mockImplementation(async (url, opts) => ({ outputPath: `out-${url}-${opts.profile}`, data: {} }));
        const results = await plan(URLS, RUNS, {});
        expect(results.map((r) => `${r.url}|${r.profile}`)).toEqual([
            'https://a.example|low',
            'https://a.example|high',
            'https://b.example|low',
            'https://b.example|high',
        ]);
    });

    it('labels network/device-only runs as "custom"', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        const results = await plan(['https://a.example'], [{ network: '3g' }], {});
        expect(results[0].profile).toBe('custom');
    });

    it('shares one browser across the whole plan when reuseBrowser is true', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(URLS, RUNS, { reuseBrowser: true });
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(killSpy).toHaveBeenCalledTimes(1);
    });

    it('launches no shared browser by default, leaving each run to isolate itself', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(URLS, RUNS);
        expect(mockLaunch).not.toHaveBeenCalled();
        expect(killSpy).not.toHaveBeenCalled();
    });

    it('passes no port by default so runLabAudit launches a fresh Chrome per run', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(URLS, RUNS);
        expect(runLabSpy).toHaveBeenCalledTimes(4);
        for (const call of runLabSpy.mock.calls) {
            expect(call[1].port).toBeUndefined();
        }
    });

    it('passes the shared port into every run when reusing the browser', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(URLS, RUNS, { reuseBrowser: true });
        expect(runLabSpy).toHaveBeenCalledTimes(4);
        for (const call of runLabSpy.mock.calls) {
            expect(call[1].port).toBe(9999);
        }
    });

    it('reports progress through hooks with 1-based runIndex and totalRuns', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        const onRunStart = vi.fn();
        const onRunComplete = vi.fn();
        await plan(URLS, RUNS, {}, { onRunStart, onRunComplete });
        expect(onRunStart).toHaveBeenCalledTimes(4);
        expect(onRunComplete).toHaveBeenCalledTimes(4);
        expect(onRunStart.mock.calls[0][0]).toMatchObject({ runIndex: 1, totalRuns: 4, profile: 'low' });
        expect(onRunStart.mock.calls[3][0]).toMatchObject({ runIndex: 4, totalRuns: 4, profile: 'high' });
    });

    it('collects failures and continues when continueOnError is true', async () => {
        runLabSpy
            .mockResolvedValueOnce({ outputPath: 'out-1', data: {} })
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ outputPath: 'out-3', data: {} })
            .mockResolvedValueOnce({ outputPath: 'out-4', data: {} });
        const onRunError = vi.fn();
        const results = await plan(URLS, RUNS, { continueOnError: true }, { onRunError });
        expect(results).toHaveLength(4);
        expect(results[1].error).toBe('boom');
        expect(results[1].outputPath).toBeUndefined();
        expect(results.filter((r) => r.outputPath)).toHaveLength(3);
        expect(onRunError).toHaveBeenCalledTimes(1);
    });

    it('aborts the plan on the first failure when continueOnError is false', async () => {
        runLabSpy.mockResolvedValueOnce({ outputPath: 'out-1', data: {} }).mockRejectedValueOnce(new Error('boom'));
        await expect(plan(URLS, RUNS, { continueOnError: false })).rejects.toThrow('boom');
        expect(runLabSpy).toHaveBeenCalledTimes(2);
    });

    it('kills the shared browser even when a run throws', async () => {
        runLabSpy.mockRejectedValue(new Error('boom'));
        await expect(plan(URLS, RUNS, { reuseBrowser: true })).rejects.toThrow('boom');
        expect(killSpy).toHaveBeenCalledTimes(1);
    });

    it('forwards shared lab options to every run, with run settings taking precedence', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(['https://a.example'], [{ profile: 'low' }], {
            categories: ['performance'],
            clean: true,
            silent: true,
        });
        expect(runLabSpy.mock.calls[0][1]).toMatchObject({
            categories: ['performance'],
            clean: true,
            silent: true,
            profile: 'low',
        });
    });

    it('does not leak plan-level controls into runLab options', async () => {
        runLabSpy.mockResolvedValue({ outputPath: 'out', data: {} });
        await plan(['https://a.example'], [{ profile: 'low' }], {
            continueOnError: true,
            reuseBrowser: true,
        });
        expect(runLabSpy.mock.calls[0][1]).not.toHaveProperty('continueOnError');
        expect(runLabSpy.mock.calls[0][1]).not.toHaveProperty('reuseBrowser');
    });

    it('returns an empty result set for an empty plan without launching a browser', async () => {
        const results = await plan([], RUNS, { reuseBrowser: false });
        expect(results).toEqual([]);
        expect(mockLaunch).not.toHaveBeenCalled();
    });
});

describe('buildRunSuffix', () => {
    it('uses the profile name when no repeats are configured', () => {
        expect(buildRunSuffix({ profile: 'medium' })).toBe('medium');
    });

    it('falls back to "custom" for network/device-only runs', () => {
        expect(buildRunSuffix({ network: '3g' })).toBe('custom');
        expect(buildRunSuffix({ device: 'iphone-12' })).toBe('custom');
    });

    it('returns undefined when there is nothing to name', () => {
        expect(buildRunSuffix({})).toBeUndefined();
    });

    it('appends a zero-padded run number when repeating', () => {
        expect(buildRunSuffix({ profile: 'medium', runNumber: 1 })).toBe('medium-run01');
        expect(buildRunSuffix({ profile: 'medium', runNumber: 12 })).toBe('medium-run12');
    });

    it('uses the run number alone when there is no profile', () => {
        expect(buildRunSuffix({ runNumber: 3 })).toBe('run03');
    });
});

describe('runLabPlan — repeat runs', () => {
    let runLabSpy;
    let mockLaunch;
    let writeSpy;

    const plan = (urls, runs, options = {}, hooks = {}) => runLabPlan(
        urls,
        runs,
        { _runLab: runLabSpy, _launch: mockLaunch, ...options },
        hooks,
    );

    const reportWith = (score, benchmarkIndex) => ({
        categories: { performance: { score } },
        environment: { benchmarkIndex },
        audits: {},
    });

    beforeEach(() => {
        mockLaunch = vi.fn().mockResolvedValue({ port: 9999, kill: vi.fn() });
        // Realistic paths: writeRunSummary derives the summary name from the first run's
        // filename, so the doubles must carry the -runNN.json tail that runLab produces.
        runLabSpy = vi.fn().mockImplementation(async (url, opts) => ({
            outputPath: `/results/lab/lab-${new URL(url).hostname}-2026-09-02-120000-${opts.profile || 'custom'}`
                + `-run${String(opts.runNumber || 1).padStart(2, '0')}.json`,
            data: reportWith(0.5, 2500),
        }));
        writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('multiplies the plan by repeats and counts totalRuns accordingly', async () => {
        const onRunStart = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }, { profile: 'high' }], { repeats: 3 }, { onRunStart });
        expect(runLabSpy).toHaveBeenCalledTimes(6);
        expect(onRunStart.mock.calls[0][0]).toMatchObject({ totalRuns: 6, repeat: 1, repeats: 3 });
        expect(onRunStart.mock.calls[5][0]).toMatchObject({ runIndex: 6, repeat: 3 });
    });

    it('keeps repeats of one pair together before moving to the next', async () => {
        const onRunStart = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }, { profile: 'high' }], { repeats: 2 }, { onRunStart });
        expect(onRunStart.mock.calls.map((c) => `${c[0].profile}#${c[0].repeat}`)).toEqual([
            'low#1', 'low#2', 'high#1', 'high#2',
        ]);
    });

    it('passes a runNumber so each repeat gets its own filename', async () => {
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 3 });
        expect(runLabSpy.mock.calls.map((c) => c[1].runNumber)).toEqual([1, 2, 3]);
    });

    it('does NOT pass runNumber when repeats is 1 (filenames stay unchanged)', async () => {
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 1 });
        expect(runLabSpy.mock.calls[0][1]).not.toHaveProperty('runNumber');
    });

    it('does NOT pass runNumber when repeats is omitted entirely', async () => {
        await plan(['https://a.example'], [{ profile: 'low' }]);
        expect(runLabSpy.mock.calls[0][1]).not.toHaveProperty('runNumber');
    });

    it('writes no summary file when repeats is 1', async () => {
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 1 }, { onSummary });
        expect(writeSpy).not.toHaveBeenCalled();
        expect(onSummary).not.toHaveBeenCalled();
    });

    it('writes one summary per (url, profile) pair when repeating', async () => {
        const onSummary = vi.fn();
        await plan(
            ['https://a.example', 'https://b.example'],
            [{ profile: 'low' }],
            { repeats: 2 },
            { onSummary },
        );
        expect(onSummary).toHaveBeenCalledTimes(2);
        expect(writeSpy).toHaveBeenCalledTimes(2);
        for (const call of writeSpy.mock.calls) {
            expect(call[0]).toMatch(/\.summary\.json$/);
        }
    });

    it('summarises the group with median, spread and benchmarkIndex', async () => {
        runLabSpy
            .mockResolvedValueOnce({ outputPath: '/o/run01.json', data: reportWith(0.56, 1799) })
            .mockResolvedValueOnce({ outputPath: '/o/run02.json', data: reportWith(0.71, 2950) })
            .mockResolvedValueOnce({ outputPath: '/o/run03.json', data: reportWith(0.69, 2940) });
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'medium' }], { repeats: 3 }, { onSummary });

        const { summary } = onSummary.mock.calls[0][0];
        expect(summary.scores).toEqual([0.56, 0.71, 0.69]);
        expect(summary.median).toBe(0.69);
        expect(summary.medianRun).toBe(3);
        expect(summary.medianOutputPath).toBe('/o/run03.json');
        expect(summary.benchmarkIndex).toEqual({ min: 1799, max: 2950, values: [1799, 2950, 2940] });
        expect(summary.stability.stable).toBe(false);
        expect(summary.url).toBe('https://a.example');
        expect(summary.profile).toBe('medium');
    });

    it('treats a runtimeError report as a failed run', async () => {
        // Lighthouse resolves rather than throws when the page fails to load
        const failedLoad = {
            runtimeError: { code: 'CHROME_INTERSTITIAL_ERROR', message: 'blocked' },
            categories: {},
            environment: { benchmarkIndex: 1800 },
            audits: {},
        };
        runLabSpy.mockResolvedValue({ outputPath: '/o/run01.json', data: failedLoad });
        const onRunError = vi.fn();
        const onRunComplete = vi.fn();
        const results = await plan(
            ['https://a.example'],
            [{ profile: 'low' }],
            { repeats: 2, continueOnError: true },
            { onRunError, onRunComplete },
        );
        expect(onRunComplete).not.toHaveBeenCalled();
        expect(onRunError).toHaveBeenCalledTimes(2);
        expect(results.every((r) => r.error.startsWith('CHROME_INTERSTITIAL_ERROR'))).toBe(true);
        // the report file is still the diagnostic, so its path is reported alongside the error
        expect(results[0].outputPath).toBe('/o/run01.json');
    });

    it('writes no summary when every run produced a runtimeError report', async () => {
        runLabSpy.mockResolvedValue({
            outputPath: '/o/run01.json',
            data: { runtimeError: { code: 'NO_FCP' }, categories: {}, environment: {}, audits: {} },
        });
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 2, continueOnError: true }, { onSummary });
        expect(onSummary).not.toHaveBeenCalled();
        expect(writeSpy).not.toHaveBeenCalled();
    });

    it('aborts the plan on a runtimeError when continueOnError is false', async () => {
        runLabSpy.mockResolvedValue({
            outputPath: '/o/run01.json',
            data: { runtimeError: { code: 'DNS_FAILURE', message: 'nope' }, categories: {}, audits: {} },
        });
        await expect(plan(['https://a.example'], [{ profile: 'low' }], { repeats: 1 }))
            .rejects.toThrow('DNS_FAILURE: nope');
    });

    it('writes NO summary when every repeat in the group failed', async () => {
        // A summary whose medianOutputPath points at no file is worse than none; the
        // failures are already reported per run and in the results array.
        runLabSpy.mockRejectedValue(new Error('Chrome crashed'));
        const onSummary = vi.fn();
        const results = await plan(
            ['https://a.example'],
            [{ profile: 'low' }],
            { repeats: 3, continueOnError: true },
            { onSummary },
        );
        expect(results).toHaveLength(3);
        expect(results.every((r) => r.error)).toBe(true);
        expect(onSummary).not.toHaveBeenCalled();
        expect(writeSpy).not.toHaveBeenCalled();
    });

    it('still writes a summary when at least one repeat succeeded', async () => {
        runLabSpy
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ outputPath: '/o/run02.json', data: reportWith(0.6, 2500) });
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 2, continueOnError: true }, { onSummary });
        expect(onSummary).toHaveBeenCalledTimes(1);
        expect(onSummary.mock.calls[0][0].summary.errors).toEqual([{ run: 1, message: 'boom' }]);
    });

    it('records failed repeats in the summary without aborting the group', async () => {
        runLabSpy
            .mockResolvedValueOnce({ outputPath: '/o/run01.json', data: reportWith(0.6, 2500) })
            .mockRejectedValueOnce(new Error('Chrome crashed'))
            .mockResolvedValueOnce({ outputPath: '/o/run03.json', data: reportWith(0.7, 2550) });
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'low' }], { repeats: 3, continueOnError: true }, { onSummary });

        const { summary } = onSummary.mock.calls[0][0];
        expect(summary.runs).toBe(3);
        expect(summary.scores).toEqual([0.6, 0.7]);
        expect(summary.errors).toEqual([{ run: 2, message: 'Chrome crashed' }]);
    });

    it('writes the summary to a path derived from the run files', async () => {
        const onSummary = vi.fn();
        await plan(['https://a.example'], [{ profile: 'medium' }], { repeats: 2 }, { onSummary });
        const { summaryPath } = onSummary.mock.calls[0][0];
        // Named after run01, not regenerated — so it sorts alongside the group it summarises
        expect(summaryPath).toBe('/results/lab/lab-a.example-2026-09-02-120000-medium.summary.json');
        expect(summaryPath).not.toMatch(/-run\d+/);
        expect(writeSpy.mock.calls[0][0]).toBe(summaryPath);
    });
});

describe('writeRunSummary — path derivation', () => {
    let writeSpy;

    beforeEach(() => {
        writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const SUMMARY = { scores: [0.5] };

    it('derives the summary name from the first run, dropping the -runNN tail', () => {
        const first = '/r/lab/lab-a.example-2026-09-02-120000-medium-run01.json';
        const out = writeRunSummary('https://a.example', 'medium', SUMMARY, first);
        expect(out).toBe('/r/lab/lab-a.example-2026-09-02-120000-medium.summary.json');
    });

    it('NEVER returns the run file itself when the tail does not match', () => {
        // buildFilename appends _NN on a same-second collision, so the run tail can be
        // `-run01_01.json`. A naive strip leaves the path unchanged and the summary then
        // overwrites the report that was just written — silent data loss.
        const collided = '/r/lab/lab-a.example-2026-09-02-120000-medium-run01_01.json';
        const out = writeRunSummary('https://a.example', 'medium', SUMMARY, collided);
        expect(out).not.toBe(collided);
        expect(out).toMatch(/\.summary\.json$/);
        expect(writeSpy.mock.calls[0][0]).not.toBe(collided);
    });

    it('falls back to a generated name when no run path is available', () => {
        const out = writeRunSummary('https://a.example', 'medium', SUMMARY, undefined);
        expect(out).toMatch(/lab-a\.example-.*-medium\.summary\.json$/);
    });

    it('never writes the summary over any of the run files it summarises', () => {
        const runPaths = [
            '/r/lab/lab-a.example-2026-09-02-120000-medium-run01_01.json',
            '/r/lab/lab-a.example-2026-09-02-120000-medium-run02_01.json',
        ];
        const out = writeRunSummary('https://a.example', 'medium', SUMMARY, runPaths[0]);
        expect(runPaths).not.toContain(out);
    });
});
