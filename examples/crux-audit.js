/**
 * CrUX audit — console output only.
 *
 * Queries the Chrome UX Report API for a single URL (28-day rolling average)
 * and prints the metric distributions to the console. No files are written.
 *
 * Pages need ~300+ monthly visits to have CrUX data.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-audit.js
 */

const { runCruxAudit } = require('../lib/index');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

const RATING_EMOJI = { FAST: 'good', AVERAGE: 'needs improvement', SLOW: 'poor' };

function printMetric(name, metric) {
    if (!metric) {
        return;
    }
    const { histogram, percentiles } = metric;
    const p75 = percentiles?.p75 !== undefined ? percentiles.p75 : 'n/a';
    const distribution = histogram
        .map((bucket) => `${RATING_EMOJI[bucket.density >= 0.75 ? 'FAST' : 'AVERAGE'] ?? ''} ${Math.round((bucket.density ?? 0) * 100)}%`)
        .join('  ');
    console.log(`  ${name.padEnd(6)}  p75=${String(p75).padEnd(8)}  ${distribution}`);
}

async function main() {
    console.log(`Fetching CrUX data for ${URL} (page-level)...\n`);

    // scope: 'page' (default) — data for the specific URL
    // scope: 'origin' — aggregated data for the entire origin
    const report = await runCruxAudit(URL, API_KEY, { scope: 'page' });

    const { metrics, collectionPeriod } = report;
    const from = `${collectionPeriod?.firstDate?.year}-${collectionPeriod?.firstDate?.month}-${collectionPeriod?.firstDate?.day}`;
    const to = `${collectionPeriod?.lastDate?.year}-${collectionPeriod?.lastDate?.month}-${collectionPeriod?.lastDate?.day}`;
    console.log(`Collection period: ${from} → ${to}`);
    console.log(`Scope            : ${report.scope}`);
    console.log(`URL              : ${report.url}\n`);

    console.log('=== Metrics (good / needs improvement / poor) ===');
    printMetric('LCP', metrics?.largest_contentful_paint);
    printMetric('FID', metrics?.first_input_delay);
    printMetric('CLS', metrics?.cumulative_layout_shift);
    printMetric('FCP', metrics?.first_contentful_paint);
    printMetric('TTFB', metrics?.experimental_time_to_first_byte);
    printMetric('INP', metrics?.interaction_to_next_paint);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
