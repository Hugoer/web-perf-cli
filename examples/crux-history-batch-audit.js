/**
 * CrUX History batch audit — console output only.
 *
 * Fetches ~6 months of weekly CrUX history for multiple URLs concurrently
 * and prints the latest and oldest LCP p75 for each, giving a sense of
 * whether performance has improved or regressed over time.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-history-batch-audit.js
 */

const { runCruxHistoryAuditBatch } = require('@hugoer/web-perf-cli');

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

function getTrend(delta) {
    if (delta === null) {
        return '';
    }
    if (delta < 0) {
        return ' (improved)';
    }
    if (delta > 0) {
        return ' (regressed)';
    }
    return '';
}

function onProgress(completed, total, url, error) {
    const status = error ? `ERROR: ${error}` : 'done';
    console.log(`  [${completed}/${total}] ${url} — ${status}`);
}

async function main() {
    console.log(`Fetching CrUX history for ${URLS.length} URLs...\n`);

    const results = await runCruxHistoryAuditBatch(URLS, API_KEY, {
        scope: 'page',
        concurrency: 2,
        onProgress,
    });

    console.log('\n=== LCP Trend (oldest → latest) ===');
    console.log(`${'URL'.padEnd(40) + 'Oldest LCP p75'.padEnd(18) + 'Latest LCP p75'.padEnd(18)}Delta`);
    console.log('─'.repeat(90));

    for (const { url, data, error } of results) {
        if (error) {
            console.log(`${url.padEnd(40)} ERROR: ${error}`);
        } else {
            const p75s = data.metrics?.largest_contentful_paint?.percentilesTimeseries?.p75s ?? [];
            const oldest = p75s[0];
            const latest = p75s[p75s.length - 1];
            const delta = oldest !== undefined && latest !== undefined ? latest - oldest : null;
            const deltaStr = delta !== null ? `${delta > 0 ? '+' : ''}${delta}ms` : 'n/a';
            const trend = getTrend(delta);
            console.log(
                `${url.padEnd(40)}${String(oldest ?? 'n/a').padEnd(18)}${String(latest ?? 'n/a').padEnd(18)}${deltaStr}${trend}`
            );
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
