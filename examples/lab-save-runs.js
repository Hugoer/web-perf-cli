/**
 * Repeat runs across a plan — save to disk.
 *
 * `runLabPlan` is the orchestrator behind `web-perf lab`. It walks every
 * (URL x profile x repeat) combination, owns the browser lifecycle, writes each report, and
 * reports progress through callbacks instead of logging — so a caller can render progress
 * however it likes.
 *
 * With `repeats > 1` every run is written with a `-runNN` suffix and each (URL x profile)
 * pair also gets a `.summary.json` recording the median, the spread and the benchmarkIndex
 * range. The summary is named after the group's FIRST run, so it sorts next to `-run01`.
 *
 * This is the library equivalent of:
 *   web-perf lab --runs=3 --profile=medium --urls=<url1>,<url2>
 *
 * Prerequisites: Chrome must be installed on this machine.
 *
 * Run: node examples/lab-save-runs.js
 */

// runLabPlan lives on the `lab` subpath rather than the package root
const { runLabPlan } = require('@hugoer/web-perf-cli/lab');

const URLS = ['https://web.dev'];
const RUNS = [{ profile: 'medium' }];
const REPEATS = 3;

async function main() {
    const total = URLS.length * RUNS.length * REPEATS;
    console.log(`Running ${total} audits (${REPEATS} repeats per URL x profile)...\n`);

    const results = await runLabPlan(
        URLS,
        RUNS,
        {
            repeats: REPEATS,
            categories: ['performance'],
            // Collect failures instead of aborting the whole plan on the first one
            continueOnError: true,
            silent: true,
            // reuseBrowser defaults to false: each run gets a fresh Chrome so no run inherits
            // warm DNS caches or socket pools from the one before it. It cannot be combined
            // with repeats — that would measure the connection pool warming up, not the page.
        },
        {
            onRunStart: ({ url, profile, repeat, repeats }) => {
                console.log(`  ${url} [${profile}] run ${repeat}/${repeats}...`);
            },
            onRunError: ({ url, profile, error }) => {
                console.error(`  ${url} [${profile}] failed: ${error}`);
            },
            onSummary: ({ url, profile, summary, summaryPath }) => {
                const median = summary.median === null ? 'n/a' : Math.round(summary.median * 100);
                console.log(`\n  ${url} [${profile}] median ${median}`);
                summary.stability.warnings.forEach((w) => console.error(`    warning: ${w}`));
                console.log(`    summary: ${summaryPath}`);
                console.log(`    median run: ${summary.medianOutputPath}`);
            },
        },
    );

    const succeeded = results.filter((r) => r.outputPath);
    const failed = results.filter((r) => r.error);
    console.log(`\nDone: ${succeeded.length} succeeded, ${failed.length} failed`);
    succeeded.forEach((r) => console.log(`  ${r.outputPath}`));
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
