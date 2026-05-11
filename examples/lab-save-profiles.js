/**
 * Lab audit with profiles — save to disk.
 *
 * Runs one Lighthouse audit per profile and writes each result to its own
 * file under results/lab/. The profile name is included in the filename
 * (e.g. lab-example.com-2025-01-01-120000-low.json).
 *
 * Run: node examples/lab-save-profiles.js
 */

const { runLab } = require('@hugoer/web-perf-cli');

const URL = 'https://web.dev';
const PROFILES = ['low', 'medium', 'high'];

async function main() {
    // Lighthouse uses global performance.mark() — parallel runs corrupt each other's marks
    const results = [];
    for (const profile of PROFILES) {
        // eslint-disable-next-line no-await-in-loop
        const outputPath = await runLab(URL, { profile });
        results.push({ profile, outputPath });
    }

    for (const { profile, outputPath } of results) {
        console.log(`Profile "${profile}": ${outputPath}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
