const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const lighthouse = require('lighthouse').default;

const { resolveProfileSettings } = require('./profiles');
const { ensureCommandDir, buildFilename } = require('./utils');

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
            console.log(`Using profile: ${labOptions.profile}`);
        }
        if (labOptions.network) {
            console.log(`Network throttling: ${labOptions.network}`);
        }
        if (labOptions.device) {
            console.log(`Device emulation: ${labOptions.device}`);
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
        const settings = {
            ...profileSettings,
            // Skip screenshot-related audits to speed up Lighthouse runs and reduce output size
            skipAudits: [
                'full-page-screenshot', // disables full-page screenshot capture
                'screenshot-thumbnails', // disables thumbnail screenshot collection
                'final-screenshot', // disables final rendered screenshot
            ],
        };
        const config = Object.keys(profileSettings).length > 0
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

module.exports = { runLab, CHROME_FLAGS };
