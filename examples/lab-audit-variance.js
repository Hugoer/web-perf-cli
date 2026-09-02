/**
 * Run-to-run variance — console output only.
 *
 * Lighthouse's Lantern engine records an UNTHROTTLED trace and re-times it. Observed CPU
 * task durations are scaled by cpuSlowdownMultiplier with no correction for how fast the
 * machine was at the time, and each origin's observed server latency is added on top of the
 * simulated RTT. A busy host or a cold connection pool therefore lands directly in the score.
 *
 * Lighthouse reports a per-run CPU benchmark in environment.benchmarkIndex but does not act
 * on it. This example audits one URL N times and uses the pure `variance` helpers to pick a
 * median and report how much the host moved — without writing anything to disk.
 *
 * Prerequisites: Chrome must be installed on this machine.
 *
 * Run: node examples/lab-audit-variance.js
 */

const { runLabAudit } = require('@hugoer/web-perf-cli');
const { buildRunSummary, formatRunLine, formatSummaryLine } = require('@hugoer/web-perf-cli/variance');

const URL = 'https://web.dev';
const RUNS = 3;

async function main() {
    console.log(`Auditing ${URL} ${RUNS}x to measure variance...\n`);

    // Lighthouse uses global performance.mark() — parallel runs corrupt each other's marks.
    // Each runLabAudit call launches and kills its own Chrome, so every run starts with cold
    // DNS caches and socket pools. Reusing one browser would make later runs look faster.
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const report = await runLabAudit(URL, {
                profile: 'medium',
                categories: ['performance'],
                silent: true,
            });
            runs.push({ report });
            console.log(`  run ${i}/${RUNS}  ${formatRunLine(report)}`);
        } catch (err) {
            runs.push({ error: err.message });
            console.log(`  run ${i}/${RUNS}  failed: ${err.message}`);
        }
    }

    // buildRunSummary is pure — plain objects in, plain object out, no I/O.
    const summary = buildRunSummary(runs, { url: URL, profile: 'medium' });

    console.log(`\n${formatSummaryLine(summary)}`);

    // For an even run count the LOWER median is chosen, so medianRun always names a run that
    // actually happened rather than an interpolated value between two of them.
    console.log(`\nMedian run  : ${summary.medianRun ?? 'n/a'} of ${summary.runs}`);
    // scores holds a null for any run that carried no performance category
    console.log(`Scores      : ${summary.scores.map((s) => (s === null ? 'n/a' : Math.round(s * 100))).join(', ')}`);
    console.log(`TBT per run : ${summary.metrics['total-blocking-time'].join(', ')} ms`);

    if (!summary.stability.stable) {
        console.log('\nHost was not stable during these runs:');
        summary.stability.warnings.forEach((w) => console.log(`  - ${w}`));
        console.log('\nScores are reported as measured — they are never rescaled after the fact.');
    } else {
        console.log('\nHost was stable across all runs; the median is trustworthy.');
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
