/**
 * Lab audit with profiles — console output only.
 *
 * Runs three Lighthouse audits back-to-back using the built-in profiles:
 *   low    → Budget phone on 3G (Moto G Power, Regular 3G, CPU 4x)
 *   medium → Mid-range phone on 4G (Moto G Power, Slow 4G, CPU 4x)
 *   high   → Desktop on broadband (Desktop 1350x940, WiFi, CPU 1x)
 *
 * Prints a side-by-side score comparison to the console.
 *
 * Run: node examples/lab-audit-profiles.js
 */

const { runLabAudit } = require('../lib/index');

const URL = 'https://example.com';
const PROFILES = ['low', 'medium', 'high'];

async function auditProfile(profile) {
    console.log(`  Running profile "${profile}"...`);
    const report = await runLabAudit(URL, { profile, silent: true });
    return {
        profile,
        formFactor: report.formFactor,
        scores: Object.fromEntries(
            Object.entries(report.categories).map(([id, cat]) => [
                id,
                cat.score !== null ? Math.round(cat.score * 100) : null,
            ])
        ),
        lcp: report.audits['largest-contentful-paint']?.displayValue ?? 'n/a',
        tbt: report.audits['total-blocking-time']?.displayValue ?? 'n/a',
        cls: report.audits['cumulative-layout-shift']?.displayValue ?? 'n/a',
    };
}

async function main() {
    console.log(`Auditing ${URL} across ${PROFILES.length} profiles...\n`);

    const results = await Promise.all(PROFILES.map((profile) => auditProfile(profile)));

    // Print comparison table
    const col = 12;
    const header = 'Profile'.padEnd(col) + results.map((r) => r.profile.padEnd(col)).join('');
    console.log(`\n${header}`);
    console.log('─'.repeat(header.length));

    const categories = Object.keys(results[0].scores);
    for (const cat of categories) {
        const label = cat.replace(/-/g, ' ');
        const row = label.padEnd(col) + results.map((r) => String(r.scores[cat] ?? 'n/a').padEnd(col)).join('');
        console.log(row);
    }

    console.log('─'.repeat(header.length));
    console.log('LCP'.padEnd(col) + results.map((r) => r.lcp.padEnd(col)).join(''));
    console.log('TBT'.padEnd(col) + results.map((r) => r.tbt.padEnd(col)).join(''));
    console.log('CLS'.padEnd(col) + results.map((r) => r.cls.padEnd(col)).join(''));
    console.log('Form factor'.padEnd(col) + results.map((r) => r.formFactor.padEnd(col)).join(''));
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
