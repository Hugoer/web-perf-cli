/**
 * @param {string} url
 * @param {number} [maxDepth]
 * @param {number} [delayMs]
 * @returns {Promise<{ outputPath: string, urls: string[] }>}
 */
export function runSitemap(url: string, maxDepth?: number, delayMs?: number): Promise<{
    outputPath: string;
    urls: string[];
}>;
/**
 * @param {string} input
 * @returns {{ origin: string, sitemapUrl: string }}
 */
export function resolveSitemapUrl(input: string): {
    origin: string;
    sitemapUrl: string;
};
/**
 * @param {string} xml
 * @returns {string[]}
 */
export function extractUrls(xml: string): string[];
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
export function decodeXmlEntities(value: string): string;
/**
 * Splits child sitemap locations into those on the origin the crawl started from and those
 * pointing elsewhere.
 *
 * The sitemaps protocol already scopes a sitemap to its own host, so a cross-origin <loc>
 * inside an index is out of spec. Enforcing it also means a sitemap fetched from an
 * untrusted domain cannot steer the crawler at `http://localhost:...` or a link-local
 * metadata address and copy whatever comes back into the output file.
 *
 * A location that does not parse as a URL is rejected too — it could not be fetched anyway.
 * @param {string[]} urls
 * @param {string} origin
 * @returns {{ kept: string[], rejected: string[] }}
 */
export function partitionByOrigin(urls: string[], origin: string): {
    kept: string[];
    rejected: string[];
};
/**
 * @param {string} xml
 * @returns {boolean}
 */
export function isSitemapIndex(xml: string): boolean;
/**
 * @param {number} delayMs
 * @returns {number}
 */
export function randomizeDelay(delayMs: number): number;
