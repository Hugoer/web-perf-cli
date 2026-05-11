/**
 * CrUX batch audit — console output only.
 *
 * Fetches CrUX data for multiple URLs concurrently (up to 2.5 req/s)
 * and prints a summary table to the console. Nothing is written to disk.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-batch-audit.js
 */

const { runCruxAuditBatch } = require('@hugoer/web-perf-cli');

const URLS = [
    'https://web.dev',
    'https://developer.chrome.com',
    'https://www.wikipedia.org',
];
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

function onProgress(completed, total, url, error) {
    const status = error ? `ERROR: ${error}` : 'done';
    console.log(`  [${completed}/${total}] ${url} — ${status}`);
}

async function main() {
    console.log(`Fetching CrUX batch data for ${URLS.length} URLs...\n`);

    const results = await runCruxAuditBatch(URLS, API_KEY, {
        scope: 'page',
        concurrency: 2,
        onProgress,
    });

    console.log('\n=== LCP p75 Summary ===');
    console.log(`${'URL'.padEnd(40) + 'LCP p75'.padEnd(12)}INP p75`);
    console.log('─'.repeat(65));

    for (const { url, data, error } of results) {
        if (error) {
            console.log(`${url.padEnd(40)} ERROR: ${error}`);
        } else {
            const lcpP75 = data.metrics?.largest_contentful_paint?.percentiles?.p75 ?? 'n/a';
            const inpP75 = data.metrics?.interaction_to_next_paint?.percentiles?.p75 ?? 'n/a';
            console.log(`${url.padEnd(40)}${String(lcpP75).padEnd(12)}${inpP75}`);
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
