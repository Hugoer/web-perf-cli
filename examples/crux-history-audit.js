/**
 * CrUX History audit — console output only.
 *
 * Fetches ~6 months of weekly CrUX data for a single URL and prints
 * the LCP trend (each collection period and its p75) to the console.
 * No files are written to disk.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-history-audit.js
 */

const { runCruxHistoryAudit } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

function dateStr(d) {
    if (!d) {
        return '?';
    }
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

async function main() {
    console.log(`Fetching CrUX history for ${URL}...\n`);

    const report = await runCruxHistoryAudit(URL, API_KEY, { scope: 'page' });

    console.log(`URL              : ${report.url}`);
    console.log(`Scope            : ${report.scope}`);
    console.log(`Data points      : ${report.collectionPeriods?.length ?? 0}`);
    console.log(`Extracted at     : ${report.extractedAt}\n`);

    const lcpHistory = report.metrics?.largest_contentful_paint;
    const inpHistory = report.metrics?.interaction_to_next_paint;

    if (!lcpHistory) {
        console.log('No LCP history available.');
        return;
    }

    const periods = report.collectionPeriods ?? [];
    const lcpP75s = lcpHistory.percentilesTimeseries?.p75s ?? [];
    const inpP75s = inpHistory?.percentilesTimeseries?.p75s ?? [];

    console.log('Week ending          LCP p75    INP p75');
    console.log('─────────────────────────────────────────');
    for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        const week = dateStr(period?.lastDate);
        const lcp = lcpP75s[i] !== undefined ? `${lcpP75s[i]}ms` : 'n/a';
        const inp = inpP75s[i] !== undefined ? `${inpP75s[i]}ms` : 'n/a';
        console.log(`${week}         ${lcp.padEnd(10)} ${inp}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
