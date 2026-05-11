/**
 * Lab audit — save to disk.
 *
 * Runs a local Lighthouse audit and writes the full JSON report to
 * results/lab/<filename>.json. Prints the output path when done.
 *
 * Run: node examples/lab-save.js
 */

const { runLab } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';

async function main() {
    console.log(`Auditing ${URL} and saving to disk...\n`);

    // Default options — Lighthouse defaults (mobile emulation, simulated throttling)
    const outputPath = await runLab(URL);
    console.log(`Saved: ${outputPath}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
