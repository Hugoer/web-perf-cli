/**
 * PSI audit — console output only.
 *
 * Calls the PageSpeed Insights API for a single URL and prints the category
 * scores and Core Web Vitals to the console. No files are written to disk.
 *
 * Requires a PSI API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/psi-audit.js
 */

const { runPsiAudit } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

async function main() {
    console.log(`Running PSI audit on ${URL}...\n`);

    const report = await runPsiAudit(URL, API_KEY);

    const categories = report.lighthouseResult?.categories ?? {};
    console.log('=== Category Scores ===');
    for (const [, cat] of Object.entries(categories)) {
        const score = cat.score !== null ? Math.round(cat.score * 100) : 'n/a';
        console.log(`  ${cat.title.padEnd(22)} ${score}`);
    }

    const audits = report.lighthouseResult?.audits ?? {};
    const vitals = ['largest-contentful-paint', 'first-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'interactive', 'speed-index'];
    console.log('\n=== Key Metrics ===');
    for (const id of vitals) {
        const audit = audits[id];
        if (audit) {
            console.log(`  ${audit.title.padEnd(30)} ${audit.displayValue ?? 'n/a'}`);
        }
    }

    // Field data from CrUX if available
    const loadingExperience = report.loadingExperience;
    if (loadingExperience?.metrics) {
        console.log('\n=== Field Data (CrUX) ===');
        for (const [metric, data] of Object.entries(loadingExperience.metrics)) {
            console.log(`  ${metric.padEnd(10)} ${data.category}  (p75: ${data.percentile}ms)`);
        }
    }

    console.log(`\nAnalysis URL : ${report.analysisUTCTimestamp ?? 'n/a'}`);
    console.log(`Final URL    : ${report.id}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
