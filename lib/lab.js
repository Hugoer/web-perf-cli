const fs = require('fs');
const path = require('path');

const { cleanLabReport } = require('./clean');
const logger = require('./logger');
const { resolveProfileSettings, LAB_CATEGORIES } = require('./profiles');
const { SKIPPABLE_AUDITS } = require('./prompts');
const { stripJsonProps } = require('./strip-props');
const { ensureCommandDir, buildFilename } = require('./utils');
const { buildRunSummary, runtimeErrorOf } = require('./variance');

// Audits skipped by default — derived from SKIPPABLE_AUDITS to avoid duplication
const DEFAULT_SKIP_AUDITS = SKIPPABLE_AUDITS.filter((a) => a.defaultSkip).map((a) => a.id);

const CHROME_FLAGS = [
    '--headless', // run Chrome in headless mode (no UI)
    '--disable-gpu', // disable GPU hardware acceleration
    '--no-sandbox', // disable Chrome's sandbox (needed for some CI environments)
    '--disable-dev-shm-usage', // avoid /dev/shm issues in Docker/CI
    '--disable-extensions', // disable all Chrome extensions
    '--disable-background-networking', // reduce network noise from background services
    '--disable-default-apps', // do not install default apps on first run
    '--disable-sync', // disable syncing to Google account
    '--disable-translate', // disable translation prompts
    '--mute-audio', // mute audio output,
    '--ignore-certificate-errors', // ignore certificate errors (useful for testing sites with self-signed certs)
];

/**
 * @typedef {{ id: string, title: string, description: string, score: number|null, scoreDisplayMode: string, displayValue?: string, numericValue?: number, numericUnit?: string, details?: unknown }} LighthouseAudit
 * @typedef {{ id: string, title: string, description: string, score: number|null, auditRefs: { id: string, weight: number, group?: string }[] }} LighthouseCategory
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
 * @property {{ total: number, breakdown: Record<string, number> }} timing
 * @property {Record<string, LighthouseCategory>} categories
 * @property {Record<string, LighthouseAudit>} audits
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
 * @property {(ctx: { url: string, profile: string, summary: object, summaryPath: string }) => void} [onSummary]
 *
 * @typedef {Object} LabPlanOptions
 * @property {boolean} [continueOnError=false] - collect failures instead of aborting the plan
 * @property {boolean} [reuseBrowser=false] - share one Chrome across every run. Faster, but
 *   Lighthouse does not clear DNS caches or socket pools between runs, so later runs start
 *   warm and score better than earlier ones purely by position in the plan.
 * @property {number} [repeats=1] - audits per (url, profile) pair. Above 1, each run is
 *   written with a `-runNN` suffix and the group gets a `.summary.json` variance record.
 * @property {(url: string, opts: object) => Promise<{ outputPath: string, data: LabReport }>} [_runLab] - injectable runner (tests)
 * @property {(opts: object) => Promise<{ port: number, kill: () => Promise<void> }>} [_launch] - injectable Chrome launcher (tests)
 */

function buildLighthouseConfig(labOptions, profileSettings = {}) {
    const rawSkipAudits = labOptions.skipAudits || DEFAULT_SKIP_AUDITS;
    const disableFullPageScreenshot = rawSkipAudits.includes('full-page-screenshot');
    const skipAudits = rawSkipAudits.filter((a) => a !== 'full-page-screenshot');
    const blockedUrlPatterns = labOptions.blockedUrlPatterns || [];
    // Only pin onlyCategories for a proper subset; an empty or full selection keeps the
    // Lighthouse default (all categories, including agentic-browsing).
    const categories = labOptions.categories || [];
    const filterCategories = categories.length > 0 && categories.length < LAB_CATEGORIES.length;
    const settings = {
        ...profileSettings,
        skipAudits,
        ...(disableFullPageScreenshot && { disableFullPageScreenshot: true }),
        ...(blockedUrlPatterns.length > 0 && { blockedUrlPatterns }),
        ...(filterCategories && { onlyCategories: categories }),
    };
    const hasSettings = Object.keys(profileSettings).length > 0 || skipAudits.length > 0 || disableFullPageScreenshot || blockedUrlPatterns.length > 0 || filterCategories;
    return hasSettings ? { extends: 'lighthouse:default', settings } : undefined;
}

/**
 * @param {string} url
 * @param {{ port?: number, profile?: string, network?: string, device?: string, skipAudits?: string[], blockedUrlPatterns?: string[], categories?: string[], stripJsonProps?: boolean, silent?: boolean }} [labOptions]
 * @returns {Promise<LabReport>}
 */
async function runLabAudit(url, labOptions = {}) {
    const [chromeLauncher, { default: lighthouse }] = await Promise.all([
        import('chrome-launcher'),
        import('lighthouse'),
    ]);
    const profileSettings = resolveProfileSettings(labOptions);
    const externalPort = labOptions.port;
    const chrome = externalPort ? null : await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });
    const port = externalPort || chrome.port;

    try {
        const flags = { port, output: 'json', logLevel: 'error' };
        const config = buildLighthouseConfig(labOptions, profileSettings);
        const result = await lighthouse(url, flags, config);
        const report = JSON.parse(result.report);
        return labOptions.stripJsonProps !== false ? stripJsonProps(report) : report;
    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }
}

function writeLabResult(outputPath, data, labOptions = {}) {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    if (labOptions.clean === true) {
        const cleanDir = path.join(path.dirname(outputPath), 'clean');
        fs.mkdirSync(cleanDir, { recursive: true });
        const base = path.basename(outputPath, '.json');
        const cleanOutputPath = path.join(cleanDir, `${base}.clean.json`);
        fs.writeFileSync(cleanOutputPath, JSON.stringify(cleanLabReport(data), null, 2));
        if (!labOptions.silent) {
            logger.info(`Clean output: ${cleanOutputPath}`);
        }
    }
}

/**
 * Builds the filename suffix for a run: the profile name, 'custom' for network/device-only
 * runs, and a `-runNN` tail once a plan repeats the same (url, profile) pair.
 * @param {{ profile?: string, network?: string, device?: string, runNumber?: number }} labOptions
 * @returns {string|undefined}
 */
function buildRunSuffix(labOptions) {
    const base = labOptions.profile || (labOptions.network || labOptions.device ? 'custom' : undefined);
    if (!labOptions.runNumber) {
        return base;
    }
    const runPart = `run${String(labOptions.runNumber).padStart(2, '0')}`;
    return base ? `${base}-${runPart}` : runPart;
}

/**
 * Runs one audit and writes it to disk, returning the report alongside its path.
 * `runLab` wraps this to keep its published `Promise<string>` signature; `runLabPlan` uses
 * it directly so summaries can read scores without re-parsing the file it just wrote.
 * @param {string} url
 * @param {object} [labOptions]
 * @returns {Promise<{ outputPath: string, data: LabReport }>}
 */
async function runLabToDisk(url, labOptions = {}) {
    ensureCommandDir('lab');

    if (!labOptions.silent) {
        if (labOptions.profile) {
            logger.info(`Using profile: ${labOptions.profile}`);
        }
        if (labOptions.network) {
            logger.info(`Network throttling: ${labOptions.network}`);
        }
        if (labOptions.device) {
            logger.info(`Device emulation: ${labOptions.device}`);
        }
    }

    const data = await runLabAudit(url, labOptions);
    const outputPath = buildFilename(url, 'lab', buildRunSuffix(labOptions));
    writeLabResult(outputPath, data, labOptions);
    return { outputPath, data };
}

async function runLab(url, labOptions = {}) {
    const { outputPath } = await runLabToDisk(url, labOptions);
    return outputPath;
}

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
function writeRunSummary(url, profile, summary, firstRunPath) {
    ensureCommandDir('lab');
    // buildFilename appends _NN on a same-second collision, so the run tail is not always
    // plain `-runNN.json`. Fall back to a generated name unless the strip actually matched —
    // otherwise the "derived" path is the run's own filename and the summary overwrites it.
    const derived = firstRunPath && firstRunPath.replace(/-run\d+(_\d+)?\.json$/, '.summary.json');
    const outputPath = derived && derived !== firstRunPath
        ? derived
        : buildFilename(url, 'lab', profile, 'summary.json');
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    return outputPath;
}

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
async function runLabPlan(urls, runs, options = {}, hooks = {}) {
    // `_runLab` / `_launch` mirror the injection pattern withRetry uses for `_sleep`. They are
    // the only seams available: lib modules are loaded with require(), which bypasses the test
    // runner's module graph, so vi.mock() cannot intercept their dependencies.
    const {
        continueOnError = false,
        reuseBrowser = false,
        repeats = 1,
        _runLab: runLabFn = runLabToDisk,
        // eslint-disable-next-line global-require
        _launch: launchFn = (opts) => require('chrome-launcher').launch(opts),
        ...labOptions
    } = options;
    const repeatCount = Math.max(1, repeats);
    const totalRuns = urls.length * runs.length * repeatCount;
    const results = [];
    let runIndex = 0;

    // reuseBrowser === false relies on runLabAudit launching (and killing) its own Chrome
    // when no port is supplied, so there is only ever one browser-lifecycle implementation.
    // chrome-launcher is CJS, so require() is enough — the dynamic import in runLabAudit
    // exists only because lighthouse v13 is ESM-only. Required lazily to keep it off the
    // startup path of commands that never launch a browser.
    const chrome = reuseBrowser
        ? await launchFn({ chromeFlags: CHROME_FLAGS })
        : null;

    try {
        for (const url of urls) {
            for (const run of runs) {
                const profile = run.profile || 'custom';
                // Repeats of one (url, profile) pair are samples of a single measurement,
                // so they are summarised together once the group completes.
                const group = [];

                for (let repeat = 1; repeat <= repeatCount; repeat++) {
                    runIndex++;
                    const context = {
                        url, profile, runIndex, totalRuns, repeat, repeats: repeatCount,
                    };
                    if (hooks.onRunStart) {
                        hooks.onRunStart(context);
                    }
                    let outputPath;
                    let data;
                    let failure = null;
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        ({ outputPath, data } = await runLabFn(url, {
                            ...labOptions,
                            ...run,
                            ...(repeatCount > 1 ? { runNumber: repeat } : {}),
                            ...(chrome ? { port: chrome.port } : {}),
                        }));
                        // Lighthouse resolves rather than throws when the page fails to load,
                        // handing back a report with runtimeError and no usable metrics. The
                        // file is still written — it is the diagnostic — but the run failed.
                        const runtimeError = runtimeErrorOf(data);
                        if (runtimeError) {
                            failure = new Error(runtimeError);
                        }
                    } catch (err) {
                        failure = err;
                    }

                    if (failure) {
                        group.push({ error: failure.message, outputPath });
                        results.push({ url, profile, ...(outputPath && { outputPath }), error: failure.message });
                        if (!continueOnError) {
                            throw failure;
                        }
                        if (hooks.onRunError) {
                            hooks.onRunError({ ...context, outputPath, error: failure.message });
                        }
                    } else {
                        group.push({ report: data, outputPath });
                        results.push({ url, profile, outputPath });
                        if (hooks.onRunComplete) {
                            hooks.onRunComplete({ ...context, outputPath, report: data });
                        }
                    }
                }

                // A group in which every run failed has nothing to summarise: it would write a
                // record whose medianOutputPath points at no file. Those runs are already
                // reported individually through onRunError and the results array.
                const firstRunPath = (group.find((g) => g.report && g.outputPath) || {}).outputPath;
                if (repeatCount > 1 && firstRunPath) {
                    const summary = buildRunSummary(group, { url, profile });
                    const summaryPath = writeRunSummary(url, profile, summary, firstRunPath);
                    if (hooks.onSummary) {
                        hooks.onSummary({ url, profile, summary, summaryPath });
                    }
                }
            }
        }
    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }

    return results;
}

module.exports = {
    runLab,
    runLabPlan,
    runLabAudit,
    runLabToDisk,
    buildLighthouseConfig,
    buildRunSuffix,
    writeLabResult,
    writeRunSummary,
    CHROME_FLAGS,
    DEFAULT_SKIP_AUDITS,
};
