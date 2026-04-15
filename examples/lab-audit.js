/**
 * Lab audit — console output only.
 *
 * Runs a local Lighthouse audit using headless Chrome and prints the results
 * to the console. No files are written to disk.
 *
 * Prerequisites: Chrome must be installed on this machine.
 *
 * Run: node examples/lab-audit.js
 */

const { runLabAudit } = require('../lib/index');

const URL = 'https://example.com';

async function main() {
    console.log(`Running Lighthouse audit on ${URL}...\n`);

    const report = await runLabAudit(URL);

    // Category scores (0–1, multiply by 100 for a percentage)
    console.log('=== Category Scores ===');
    for (const category of Object.values(report.categories)) {
        const score = category.score !== null ? Math.round(category.score * 100) : 'n/a';
        console.log(`  ${category.title.padEnd(20)} ${score}`);
    }

    // Core Web Vitals
    const vitals = ['largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'first-contentful-paint', 'speed-index', 'interactive'];
    console.log('\n=== Key Metrics ===');
    for (const id of vitals) {
        const audit = report.audits[id];
        if (audit) {
            const value = audit.displayValue ?? (audit.numericValue !== undefined ? `${audit.numericValue}${audit.numericUnit ?? ''}` : 'n/a');
            console.log(`  ${audit.title.padEnd(30)} ${value}`);
        }
    }

    console.log(`\nForm factor : ${report.formFactor}`);
    console.log(`Fetched at  : ${report.fetchTime}`);
    console.log(`Lighthouse  : ${report.lighthouseVersion}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
