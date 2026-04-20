const fs = require('fs');
const path = require('path');

const { cleanLabReport } = require('./clean');
const logger = require('./logger');
const { resolveProfileSettings } = require('./profiles');
const { SKIPPABLE_AUDITS } = require('./prompts');
const { stripJsonProps } = require('./strip-props');
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

/**
 * @typedef {{ id: string, title: string, description: string, score: number|null, scoreDisplayMode: string, displayValue?: string, numericValue?: number, numericUnit?: string, details?: unknown }} LighthouseAudit
 * @typedef {{ id: string, title: string, description: string, score: number|null, auditRefs: { id: string, weight: number, group?: string }[] }} LighthouseCategory
 */

/**
 * @typedef {Object} LabReport
 * @property {string} lighthouseVersion
 * @property {string} requestedUrl
 * @property {string} finalUrl
 * @property {string} fetchTime
 * @property {'desktop'|'mobile'} formFactor
 * @property {{ total: number, breakdown: Record<string, number> }} timing
 * @property {Record<string, LighthouseCategory>} categories
 * @property {Record<string, LighthouseAudit>} audits
 */

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

/**
 * @param {string} url
 * @param {{ port?: number, profile?: string, network?: string, device?: string, skipAudits?: string[], blockedUrlPatterns?: string[], stripJsonProps?: boolean, silent?: boolean }} [labOptions]
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
        logger.info(`Clean output: ${cleanOutputPath}`);
    }
}

async function runLab(url, labOptions = {}) {
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
    const suffix = labOptions.profile || (labOptions.network || labOptions.device ? 'custom' : undefined);
    const outputPath = buildFilename(url, 'lab', suffix);
    writeLabResult(outputPath, data, labOptions);
    return outputPath;
}

module.exports = { runLab, runLabAudit, buildLighthouseConfig, writeLabResult, CHROME_FLAGS, DEFAULT_SKIP_AUDITS };
