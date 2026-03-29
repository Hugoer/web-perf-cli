const fs = require('fs');
const chromeLauncher = require('chrome-launcher');
const lighthouse = require('lighthouse').default;
const { ensureModeDir, buildFilename } = require('./utils');

async function runLab(url) {
    ensureModeDir('lab');

    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

    try {
        const result = await lighthouse(url, {
            port: chrome.port,
            output: 'json',
            logLevel: 'error',
        });

        const outputPath = buildFilename(url, 'lab');
        fs.writeFileSync(outputPath, result.report);

        return outputPath;
    } finally {
        await chrome.kill();
    }
}

module.exports = { runLab };
