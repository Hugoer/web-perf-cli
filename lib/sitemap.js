const fs = require('fs');

const { ensureCommandDir, buildFilename, sleep } = require('./utils');

/**
 * @param {string} input
 * @returns {{ origin: string, sitemapUrl: string }}
 */
function resolveSitemapUrl(input) {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const clean = url.replace(/\/$/, '');
    if (/\.xml(\.gz)?$/i.test(clean)) {
        return { origin: new URL(clean).origin, sitemapUrl: clean };
    }
    // `origin` must be an origin even when the input carried a path: a bare
    // `https://example.com/es` would otherwise be reported as the origin itself.
    return { origin: new URL(clean).origin, sitemapUrl: `${clean}/sitemap.xml` };
}

const XML_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
};

/**
 * Turns a numeric character reference into its character, or null when the reference is
 * out of range. Out-of-range values are left as written rather than throwing: a malformed
 * entity in someone else's sitemap should not abort the extraction.
 * @param {string} digits
 * @param {number} radix
 * @returns {string|null}
 */
function decodeCharRef(digits, radix) {
    const code = parseInt(digits, radix);
    if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF) {
        return null;
    }
    return String.fromCodePoint(code);
}

/**
 * Decodes the five XML predefined entities plus numeric character references.
 *
 * The sitemaps protocol REQUIRES these to be escaped inside <loc>, so a URL carrying a
 * query string arrives as `?a=1&amp;b=2` and is not the URL the site meant until it is
 * decoded. Done in a single pass so an escaped entity like `&amp;lt;` yields the literal
 * text `&lt;` instead of being decoded twice into `<`.
 * @param {string} value
 * @returns {string}
 */
function decodeXmlEntities(value) {
    return value.replace(
        /&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
        (match, decimal, hex, named) => {
            if (decimal !== undefined) {
                return decodeCharRef(decimal, 10) ?? match;
            }
            if (hex !== undefined) {
                return decodeCharRef(hex, 16) ?? match;
            }
            const mapped = XML_ENTITIES[named.toLowerCase()];
            return mapped !== undefined ? mapped : match;
        },
    );
}

/**
 * @param {string} xml
 * @returns {string[]}
 */
function extractUrls(xml) {
    const urls = [];
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
    let match = locRegex.exec(xml);
    while (match !== null) {
        urls.push(decodeXmlEntities(match[1]));
        match = locRegex.exec(xml);
    }
    return urls;
}

/**
 * @param {string} xml
 * @returns {boolean}
 */
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

/**
 * @param {number} delayMs
 * @returns {number}
 */
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

/**
 * @param {string} url
 * @param {number} [maxDepth]
 * @param {number} [delayMs]
 * @returns {Promise<{ outputPath: string, urls: string[] }>}
 */
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
    decodeXmlEntities,
    isSitemapIndex,
    randomizeDelay
};
