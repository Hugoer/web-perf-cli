/**
 * CrUX audit — save to disk.
 *
 * Queries the CrUX API for a single URL and writes one file per form factor to
 * results/crux/crux-<hostname>-<timestamp>-<form-factor>.json. Defaults to phone + desktop,
 * so this writes two files. Prints each output path when done.
 *
 * Requires a PSI/CrUX API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/crux-save.js
 */

const { runCrux } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

async function main() {
    console.log(`Fetching CrUX data for ${URL} and saving to disk...\n`);

    // runCrux returns ONE PATH PER FORM FACTOR — it defaults to phone + desktop,
    // so this writes two files. Form factors with no CrUX data are skipped, not thrown.
    const outputPaths = await runCrux(URL, API_KEY, {
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
