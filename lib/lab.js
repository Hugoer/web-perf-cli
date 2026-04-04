const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const lighthouse = require('lighthouse').default;

const logger = require('./logger');
const { resolveProfileSettings } = require('./profiles');
const { ensureCommandDir, buildFilename } = require('./utils');

// All audits available for skipping in interactive prompt
const SKIPPABLE_AUDITS = [
    { id: 'full-page-screenshot', label: 'Full-page screenshot capture', defaultSkip: true },
    { id: 'screenshot-thumbnails', label: 'Filmstrip thumbnail screenshots', defaultSkip: true },
    { id: 'final-screenshot', label: 'Final rendered state screenshot', defaultSkip: true },
    { id: 'valid-source-maps', label: 'Source map validation check', defaultSkip: true },
    { id: 'script-treemap-data', label: 'JS treemap/bundle data (often the largest audit)', defaultSkip: false },
    { id: 'network-requests', label: 'Full network request log', defaultSkip: false },
    { id: 'main-thread-tasks', label: 'Detailed main-thread task breakdown', defaultSkip: false },
    { id: 'third-party-summary', label: 'Third-party resource analysis', defaultSkip: false },
    { id: 'layout-shifts', label: 'Individual CLS shift elements', defaultSkip: false },
    { id: 'long-tasks', label: 'Long main-thread tasks list', defaultSkip: false },
    { id: 'bf-cache', label: 'Back/forward cache eligibility', defaultSkip: false },
    { id: 'resource-summary', label: 'Resource count and size summary', defaultSkip: false },
];

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
    '--mute-audio', // mute audio output
];

async function runLab(url, labOptions = {}) {
    ensureCommandDir('lab');

    const profileSettings = resolveProfileSettings(labOptions);

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

    const externalPort = labOptions.port;
    const chrome = externalPort ? null : await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });
    const port = externalPort || chrome.port;

    try {
        const flags = {
            port,
            output: 'json',
            logLevel: 'error',
        };
        const skipAudits = labOptions.skipAudits || DEFAULT_SKIP_AUDITS;
        const blockedUrlPatterns = labOptions.blockedUrlPatterns || [];
        const settings = {
            ...profileSettings,
            skipAudits,
            ...(blockedUrlPatterns.length > 0 && { blockedUrlPatterns }),
        };
        const hasSettings = Object.keys(profileSettings).length > 0 || skipAudits.length > 0 || blockedUrlPatterns.length > 0;
        const config = hasSettings
            ? { extends: 'lighthouse:default', settings }
            : undefined;

        const result = await lighthouse(url, flags, config);

        const suffix = labOptions.profile || (labOptions.network || labOptions.device ? 'custom' : undefined);
        const outputPath = buildFilename(url, 'lab', suffix);
        fs.writeFileSync(outputPath, result.report);

        return outputPath;
    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }
}

module.exports = { runLab, CHROME_FLAGS, DEFAULT_SKIP_AUDITS, SKIPPABLE_AUDITS };
