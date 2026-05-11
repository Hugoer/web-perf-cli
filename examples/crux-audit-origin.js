/**
 * CrUX audit at origin scope — console output only.
 *
 * Fetches aggregated CrUX data for the entire origin (all pages combined)
 * rather than for a specific URL. Useful for a high-level health check.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-audit-origin.js
 */

const { runCruxAudit } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

function goodPercent(histogram) {
    // The first bucket is always the "good" range
    return histogram?.[0] ? `${Math.round((histogram[0].density ?? 0) * 100)}%` : 'n/a';
}

async function main() {
    console.log(`Fetching CrUX origin data for ${URL}...\n`);

    const report = await runCruxAudit(URL, API_KEY, { scope: 'origin' });
    const { metrics } = report;

    console.log(`Origin: ${report.url}`);
    console.log(`Scope : ${report.scope}\n`);

    const rows = [
        ['LCP', metrics?.largest_contentful_paint],
        ['FID', metrics?.first_input_delay],
        ['CLS', metrics?.cumulative_layout_shift],
        ['FCP', metrics?.first_contentful_paint],
        ['TTFB', metrics?.experimental_time_to_first_byte],
        ['INP', metrics?.interaction_to_next_paint],
    ];

    console.log('Metric  Good    p75');
    console.log('──────────────────────');
    for (const [name, metric] of rows) {
        if (metric) {
            const p75 = metric.percentiles?.p75 ?? 'n/a';
            const good = goodPercent(metric.histogram);
            console.log(`${name.padEnd(7)} ${good.padEnd(7)} ${p75}`);
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
