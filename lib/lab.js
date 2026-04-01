const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const lighthouse = require('lighthouse').default;

const { resolveProfileSettings } = require('./profiles');
const { ensureCommandDir, buildFilename } = require('./utils');

const CHROME_FLAGS = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--mute-audio',
];

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
            skipAudits: [
                'full-page-screenshot',
                'screenshot-thumbnails',
                'final-screenshot',
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
