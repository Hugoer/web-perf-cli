/**
 * PSI audit — save to disk.
 *
 * Calls the PageSpeed Insights API for a single URL and writes the full
 * JSON response to results/psi/<filename>.json.
 *
 * Requires a PSI API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/psi-save.js
 */

const { runPsi } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

async function main() {
    console.log(`Auditing ${URL} with PSI and saving to disk...\n`);

    const outputPath = await runPsi(URL, API_KEY);
    console.log(`Saved: ${outputPath}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
