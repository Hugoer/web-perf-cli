const fs = require('fs');

const { ensureCommandDir, buildFilename, sleep } = require('./utils');

function resolveSitemapUrl(input) {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const clean = url.replace(/\/$/, '');
    if (/\.xml(\.gz)?$/i.test(clean)) {
        return { origin: new URL(clean).origin, sitemapUrl: clean };
    }
    return { origin: clean, sitemapUrl: `${clean}/sitemap.xml` };
}

function extractUrls(xml) {
    const urls = [];
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
    let match = locRegex.exec(xml);
    while (match !== null) {
        urls.push(match[1]);
        match = locRegex.exec(xml);
    }
    return urls;
}

function isSitemapIndex(xml) {
    return xml.includes('<sitemapindex');
}

async function fetchSitemap(url) {
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }
    return response.text();
}

function randomizeDelay(delayMs) {
    const jitter = Math.floor(Math.random() * 101) - 50; // -50 to +50
    return Math.max(1, delayMs + jitter);
}

async function parseSitemaps(sitemapUrl, maxDepth = 3, delayMs = 0, isFirst = true) {
    if (maxDepth <= 0) {
        return [];
    }

    if (!isFirst && delayMs > 0) {
        await sleep(randomizeDelay(delayMs));
    }

    console.log(`Fetching: ${sitemapUrl}`);
    const xml = await fetchSitemap(sitemapUrl);

    if (!xml) {
        console.warn(`Warning: Could not fetch ${sitemapUrl} — skipping`);
        return [];
    }

    if (isSitemapIndex(xml)) {
        const childSitemaps = extractUrls(xml);
        console.log(`Found sitemap index with ${childSitemaps.length} child sitemap(s)`);

        const results = [];
        for (const childUrl of childSitemaps) {
            const childResult = await parseSitemaps(childUrl, maxDepth - 1, delayMs, false); // eslint-disable-line no-await-in-loop
            results.push(childResult);
        }
        return results.flat();
    }

    const urls = extractUrls(xml);
    console.log(`Found ${urls.length} URL(s) in ${sitemapUrl}`);
    return urls;
}

async function runSitemap(url, maxDepth = 3, delayMs = 0) {
    ensureCommandDir('sitemap');

    const { origin, sitemapUrl } = resolveSitemapUrl(url);
    const effectiveDelay = delayMs > 0 ? delayMs : 0;

    console.log(`Extracting URLs from sitemap for: ${origin} (max depth: ${maxDepth})`);
    const urls = await parseSitemaps(sitemapUrl, maxDepth, effectiveDelay);

    if (!urls.length) {
        throw new Error(`No URLs found in sitemap at ${sitemapUrl}`);
    }

    const output = {
        origin,
        sitemapUrl,
        extractedAt: new Date().toISOString(),
        urlCount: urls.length,
        urls,
    };

    const outputPath = buildFilename(origin, 'sitemap');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    return { outputPath, urls };
}

module.exports = {
    runSitemap,
    resolveSitemapUrl,
    extractUrls,
    isSitemapIndex,
    randomizeDelay
};
