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
 * @param {string} xml
 * @returns {boolean}
 */
export function isSitemapIndex(xml: string): boolean;
/**
 * @param {number} delayMs
 * @returns {number}
 */
export function randomizeDelay(delayMs: number): number;
