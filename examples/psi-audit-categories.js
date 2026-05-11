/**
 * PSI audit with specific categories — console output only.
 *
 * Runs a PageSpeed Insights audit requesting only the Performance and SEO
 * categories, which is faster than fetching all four.
 *
 * Available categories: PERFORMANCE, ACCESSIBILITY, BEST_PRACTICES, SEO
 *
 * Requires a PSI API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/psi-audit-categories.js
 */

const { runPsiAudit } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

async function main() {
    console.log(`Running PSI audit (performance + SEO) on ${URL}...\n`);

    const report = await runPsiAudit(URL, API_KEY, ['PERFORMANCE', 'SEO']);

    const categories = report.lighthouseResult?.categories ?? {};
    for (const [, cat] of Object.entries(categories)) {
        const score = cat.score !== null ? Math.round(cat.score * 100) : 'n/a';
        console.log(`${cat.title}: ${score}`);
    }

    // Performance opportunity audits — what Lighthouse recommends fixing
    const audits = report.lighthouseResult?.audits ?? {};
    const opportunities = Object.values(audits).filter(
        (a) => a.details?.type === 'opportunity' && a.score !== null && a.score < 1
    );

    if (opportunities.length > 0) {
        console.log('\n=== Opportunities ===');
        for (const opp of opportunities) {
            const savings = opp.details?.overallSavingsMs ? `(saves ~${Math.round(opp.details.overallSavingsMs)}ms)` : '';
            console.log(`  ${opp.title} ${savings}`);
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
