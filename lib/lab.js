const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const lighthouse = require('lighthouse').default;

const { resolveProfileSettings } = require('./profiles');
const { ensureCommandDir, buildFilename } = require('./utils');

async function runLab(url, labOptions = {}) {
    ensureCommandDir('lab');

    const profileSettings = resolveProfileSettings(labOptions);

    if (labOptions.profile) {
        console.log(`Using profile: ${labOptions.profile}`);
    }
    if (labOptions.network) {
        console.log(`Network throttling: ${labOptions.network}`);
    }
    if (labOptions.device) {
        console.log(`Device emulation: ${labOptions.device}`);
    }

    const chrome = await chromeLauncher.launch({ chromeFlags: [
        '--headless', // Run Chrome in headless mode for faster startup
        '--disable-gpu', // Disable GPU to reduce resource usage in headless environments
        '--no-sandbox', // Disable sandbox for faster startup (useful in CI/Docker)
        '--disable-dev-shm-usage', // Avoid shared memory issues, improves stability in CI
        '--disable-extensions', // Disable all extensions for faster, cleaner runs
        '--disable-background-networking', // Prevent background network requests for speed
        '--disable-default-apps', // Skip loading default apps to save time
        '--disable-sync', // Disable syncing to avoid unnecessary operations
        '--disable-translate', // Disable translation UI and services for speed
        '--mute-audio' // Mute audio to save resources during audits
    ] });

    try {
        const flags = {
            port: chrome.port,
            output: 'json',
            logLevel: 'error',
        };
        const settings = {
            ...profileSettings,
            skipAudits: [
                'full-page-screenshot', // Skip full-page screenshot to speed up audit
                'screenshot-thumbnails', // Skip thumbnail screenshots for faster results
                'final-screenshot' // Skip final screenshot to reduce run time
            ],
        };
        const config = Object.keys(profileSettings).length > 0
            ? { extends: 'lighthouse:default', settings }
            : undefined;

        const result = await lighthouse(url, flags, config);

        const outputPath = buildFilename(url, 'lab');
        fs.writeFileSync(outputPath, result.report);

        return outputPath;
    } finally {
        await chrome.kill();
    }
}

module.exports = { runLab };
