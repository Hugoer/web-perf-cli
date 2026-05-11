/**
 * Lab audit with custom network and device — console output only.
 *
 * Uses explicit --network and --device flags instead of a preset profile,
 * and blocks third-party script patterns during the audit.
 *
 * Available networks : 3g-slow, 3g, 4g, 4g-fast, wifi, none
 * Available devices  : moto-g-power, iphone-12, iphone-14, ipad, desktop, desktop-large
 *
 * Run: node examples/lab-audit-custom-throttling.js
 */

const { runLabAudit } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';

async function main() {
    console.log(`Auditing ${URL} on iPhone 12 over 4G, blocking analytics...\n`);

    const report = await runLabAudit(URL, {
        network: '4g',
        device: 'iphone-12',
        blockedUrlPatterns: ['*.google-analytics.com', '*.googletagmanager.com', '*.facebook.net'],
        silent: true,
        stripJsonProps: false,
    });

    console.log('=== Scores ===');
    for (const [, category] of Object.entries(report.categories)) {
        const score = category.score !== null ? Math.round(category.score * 100) : 'n/a';
        console.log(`  ${category.title.padEnd(22)} ${score}`);
    }

    console.log('\n=== Timing ===');
    const metrics = [
        'first-contentful-paint',
        'largest-contentful-paint',
        'speed-index',
        'total-blocking-time',
        'cumulative-layout-shift',
        'interactive',
    ];
    for (const id of metrics) {
        const audit = report.audits[id];
        if (audit) {
            console.log(`  ${audit.title.padEnd(30)} ${audit.displayValue ?? 'n/a'}`);
        }
    }

    console.log(`\nForm factor : ${report.formFactor}`);
    console.log(`Total time  : ${report.timing.total}ms`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
