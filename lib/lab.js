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

    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

    try {
        const flags = {
            port: chrome.port,
            output: 'json',
            logLevel: 'error',
        };

        const config = Object.keys(profileSettings).length > 0
            ? { extends: 'lighthouse:default', settings: profileSettings }
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
