const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const lighthouse = require('lighthouse').default;

const logger = require('./logger');
const { resolveProfileSettings } = require('./profiles');
const { SKIPPABLE_AUDITS } = require('./prompts');
const { ensureCommandDir, buildFilename } = require('./utils');

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
        const config = buildLighthouseConfig(labOptions, profileSettings);

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

function buildLighthouseConfig(labOptions, profileSettings = {}) {
    const rawSkipAudits = labOptions.skipAudits || DEFAULT_SKIP_AUDITS;
    const disableFullPageScreenshot = rawSkipAudits.includes('full-page-screenshot');
    const skipAudits = rawSkipAudits.filter((a) => a !== 'full-page-screenshot');
    const blockedUrlPatterns = labOptions.blockedUrlPatterns || [];
    const settings = {
        ...profileSettings,
        skipAudits,
        ...(disableFullPageScreenshot && { disableFullPageScreenshot: true }),
        ...(blockedUrlPatterns.length > 0 && { blockedUrlPatterns }),
    };
    const hasSettings = Object.keys(profileSettings).length > 0 || skipAudits.length > 0 || disableFullPageScreenshot || blockedUrlPatterns.length > 0;
    return hasSettings ? { extends: 'lighthouse:default', settings } : undefined;
}

module.exports = { runLab, buildLighthouseConfig, CHROME_FLAGS, DEFAULT_SKIP_AUDITS };
