/**
 * PSI batch audit — save to disk.
 *
 * Runs PageSpeed Insights for multiple URLs and writes each result to its own
 * file under results/psi/. A progress line is printed for each completed URL.
 *
 * Requires a PSI API key:
 *   export WEB_PERF_PSI_API_KEY=your_key_here
 *
 * Run: node examples/psi-batch-save.js
 */

const { runPsiBatch } = require('../lib/index');

const URLS = [
    'https://example.com',
    'https://www.wikipedia.org',
    'https://web.dev',
];
const API_KEY = process.env.WEB_PERF_PSI_API_KEY;

if (!API_KEY) {
    console.error('Error: WEB_PERF_PSI_API_KEY environment variable is not set.');
    process.exit(1);
}

function onProgress(completed, total, url, error) {
    const status = error ? `ERROR: ${error}` : 'done';
    console.log(`  [${completed}/${total}] ${url} — ${status}`);
}

async function main() {
    console.log(`Running PSI batch for ${URLS.length} URLs and saving to disk...\n`);

    const results = await runPsiBatch(URLS, API_KEY, ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'], {
        concurrency: 2,
        delayMs: 250, // extra delay between requests
        onProgress,
    });

    console.log('\n=== Saved Files ===');
    for (const { url, outputPath, error } of results) {
        if (error) {
            console.log(`  ${url}\n    ERROR: ${error}`);
        } else {
            console.log(`  ${url}\n    → ${outputPath}`);
        }
    }

    const failed = results.filter((r) => r.error).length;
    console.log(`\n${results.length - failed}/${results.length} succeeded.`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
