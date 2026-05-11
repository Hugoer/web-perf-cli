/**
 * CrUX History audit — save to disk.
 *
 * Fetches ~6 months of weekly CrUX data for a single URL and writes it
 * to results/crux-history/<filename>.json. Prints the output path when done.
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

    const outputPath = await runCruxHistory(URL, API_KEY, { scope: 'page' });
    console.log(`Saved: ${outputPath}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
