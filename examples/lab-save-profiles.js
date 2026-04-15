/**
 * Lab audit with profiles — save to disk.
 *
 * Runs one Lighthouse audit per profile and writes each result to its own
 * file under results/lab/. The profile name is included in the filename
 * (e.g. lab-example.com-2025-01-01-120000-low.json).
 *
 * Run: node examples/lab-save-profiles.js
 */

const { runLab } = require('../lib/index');

const URL = 'https://example.com';
const PROFILES = ['low', 'medium', 'high'];

async function main() {
    const results = await Promise.all(
        PROFILES.map(async (profile) => {
            const outputPath = await runLab(URL, { profile });
            return { profile, outputPath };
        })
    );

    for (const { profile, outputPath } of results) {
        console.log(`Profile "${profile}": ${outputPath}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
