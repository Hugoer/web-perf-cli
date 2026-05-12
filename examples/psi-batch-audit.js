/**
 * PSI batch audit — console output only.
 *
 * Runs PageSpeed Insights for multiple URLs concurrently (up to 4 req/s,
 * respecting the PSI API rate limit). Results are printed to the console;
 * nothing is written to disk.
 *
 * Requires a PSI API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/psi-batch-audit.js
 */

const { runPsiAuditBatch } = require('@hugoer/web-perf-cli');

const URLS = [
    'https://example.com',
    'https://www.wikipedia.org',
    'https://web.dev',
];
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;
// ['mobile'] | ['desktop'] | ['mobile', 'desktop'] — defaults to both when omitted
const STRATEGIES = ['mobile', 'desktop'];

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

function onProgress(completed, total, url, error) {
    const status = error ? `ERROR: ${error}` : 'done';
    console.log(`  [${completed}/${total}] ${url} — ${status}`);
}

async function main() {
    console.log(`Running PSI batch audit for ${URLS.length} URLs × ${STRATEGIES.length} strategies...\n`);

    const results = await runPsiAuditBatch(URLS, API_KEY, ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'], {
        concurrency: 2,
        strategies: STRATEGIES,
        onProgress,
    });

    console.log('\n=== Results ===');
    for (const { url, data, error } of results) {
        if (error) {
            console.log(`  ${url}\n    ERROR: ${error}\n`);
        } else {
            const categories = data.lighthouseResult?.categories ?? {};
            const perf = categories.performance?.score;
            const score = perf !== null && perf !== undefined ? Math.round(perf * 100) : 'n/a';
            const lcp = data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue ?? 'n/a';
            console.log(`  ${url}\n    Performance: ${score}  LCP: ${lcp}\n`);
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
