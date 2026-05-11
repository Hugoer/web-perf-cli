/**
 * CrUX History batch audit — save to disk.
 *
 * Fetches ~6 months of weekly CrUX history for multiple URLs and writes
 * each result to its own file under results/crux-history/.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-history-batch-save.js
 */

const { runCruxHistoryBatch } = require('@hugoer/web-perf-cli');

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
    console.log(`Fetching CrUX history for ${URLS.length} URLs and saving to disk...\n`);

    const results = await runCruxHistoryBatch(URLS, API_KEY, {
        scope: 'page',
        concurrency: 2,
        onProgress,
    });

    console.log('\n=== Saved Files ===');
    for (const { url, outputPath, error } of results) {
        if (error) {
            console.log(`  ${url}\n    ERROR: ${error}`);
        } else {
            console.log(`  ${url}\n    → ${outputPath}`);
        }
    }

    const failed = results.filter((r) => r.error).length;
    console.log(`\n${results.length - failed}/${results.length} succeeded.`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
