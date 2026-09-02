/**
 * CrUX History audit — save to disk.
 *
 * Fetches ~6 months of weekly CrUX data for a single URL and writes one file per form
 * factor to results/crux-history/crux-history-<hostname>-<timestamp>-<form-factor>.json.
 * Defaults to phone + desktop, so this writes two files. Prints each path when done.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-history-save.js
 */

const { runCruxHistory } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

async function main() {
    console.log(`Fetching CrUX history for ${URL} and saving to disk...\n`);

    // runCruxHistory returns ONE PATH PER FORM FACTOR — it defaults to phone + desktop,
    // so this writes two files. Form factors with no CrUX data are skipped, not thrown.
    const outputPaths = await runCruxHistory(URL, API_KEY, {
        scope: 'page',
        onNoData: (formFactor, message) => console.warn(`  no data for ${formFactor}: ${message}`),
    });

    for (const p of outputPaths) {
        console.log(`Saved: ${p}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
