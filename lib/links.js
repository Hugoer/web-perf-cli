const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const { ensureCommandDir, buildFilename } = require('./utils');

async function runLinks(url) {
    ensureCommandDir('links');

    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

    try {
        const browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${chrome.port}`,
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });

        const targetHostname = new URL(url).hostname;

        // eslint-disable-next-line no-undef -- runs in browser context via puppeteer
        const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => ({
            href: a.href,
            text: a.textContent.trim(),
        })));

        const internalLinks = links.filter((link) => {
            try {
                return new URL(link.href).hostname === targetHostname;
            } catch {
                return false;
            }
        });

        const seen = new Set();
        const uniqueLinks = internalLinks.filter((link) => {
            if (seen.has(link.href)) {
                return false; 
            }
            seen.add(link.href);
            return true;
        });

        const output = {
            url,
            extractedAt: new Date().toISOString(),
            linkCount: uniqueLinks.length,
            links: uniqueLinks,
        };

        const outputPath = buildFilename(url, 'links');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        await browser.disconnect();
        return outputPath;
    } finally {
        await chrome.kill();
    }
}

module.exports = { runLinks };
