export function runSitemap(url: any, maxDepth?: number, delayMs?: number): Promise<{
    outputPath: string;
    urls: any;
}>;
export function resolveSitemapUrl(input: any): {
    origin: string;
    sitemapUrl: any;
} | {
    origin: any;
    sitemapUrl: string;
};
export function extractUrls(xml: any): string[];
export function isSitemapIndex(xml: any): any;
export function randomizeDelay(delayMs: any): number;
