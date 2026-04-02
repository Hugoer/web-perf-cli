#!/usr/bin/env node

const { program } = require('commander');

const { name, version } = require('../package.json');

async function labAction(url, options) {
    try {
        const chromeLauncher = require('chrome-launcher');
        const { promptLab, parseSkipAuditsFlag } = require('../lib/prompts');
        const { runLab, CHROME_FLAGS } = require('../lib/lab');
        const { formatElapsed } = require('../lib/utils');
        const resolved = await promptLab(url, options);
        const skipAudits = parseSkipAuditsFlag(options.skipAudits) || resolved.skipAudits;

        const totalUrls = resolved.urls.length;
        const totalRuns = totalUrls * resolved.runs.length;
        const isBatch = totalUrls > 1;

        const startTime = Date.now();
        if (isBatch) {
            console.log(`Started at ${new Date().toLocaleTimeString()}`);
            console.log(`Processing ${totalUrls} URLs × ${resolved.runs.length} profile(s) = ${totalRuns} total runs\n`);
        }

        const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });
        const results = [];
        let runIndex = 0;

        try {
            for (let urlIdx = 0; urlIdx < totalUrls; urlIdx++) {
                const targetUrl = resolved.urls[urlIdx];
                for (const run of resolved.runs) {
                    runIndex++;
                    const label = run.profile || 'custom';
                    if (isBatch) {
                        const pct = Math.round((runIndex / totalRuns) * 100);
                        process.stderr.write(`\x1B[2K\r${pct}% [URL ${urlIdx + 1}/${totalUrls}] [Run ${runIndex}/${totalRuns}] ${targetUrl} [profile: ${label}]`);
                    } else {
                        console.log(`\nRunning Lighthouse audit for: ${targetUrl} [profile: ${label}]`);
                    }
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const outputPath = await runLab(targetUrl, { ...run, skipAudits, port: chrome.port, silent: isBatch });
                        results.push({ url: targetUrl, profile: label, outputPath });
                        if (!isBatch) {
                            console.log(`Lab results saved to: ${outputPath}`);
                        }
                    } catch (err) {
                        results.push({ url: targetUrl, profile: label, error: err.message });
                        if (isBatch) {
                            process.stderr.write(`\n  Failed: ${targetUrl} [${label}] — ${err.message}\n`);
                        } else {
                            throw err;
                        }
                    }
                }
            }

            if (!isBatch && resolved.runs.length > 1) {
                console.log(`\nCompleted ${resolved.runs.length} audits.`);
            }
        } finally {
            await chrome.kill();
        }

        if (isBatch) {
            process.stderr.write('\n');
            const succeeded = results.filter((r) => !r.error);
            const failed = results.filter((r) => r.error);

            succeeded.forEach((r) => console.log(`  ${r.outputPath}`));
            console.log(`\nResults: ${succeeded.length} succeeded, ${failed.length} failed`);
            console.log(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

            if (failed.length > 0) {
                console.error('\nFailed:');
                failed.forEach((r) => console.error(`  - ${r.url} [${r.profile}]: ${r.error}`));
                process.exit(1);
            }
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function rumAction(url, options) {
    try {
        const { promptRum } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const resolved = await promptRum(url, options);

        if (resolved.urls.length === 1) {
            const { runRum } = require('../lib/rum');
            console.log(`Fetching PageSpeed Insights for: ${resolved.urls[0]}`);
            const outputPath = await runRum(resolved.urls[0], resolved.apiKey, resolved.categories);
            console.log(`RUM results saved to: ${outputPath}`);
            return;
        }

        const { runRumBatch } = require('../lib/rum');
        const concurrency = resolved.concurrency || 5;
        const delayMs = resolved.delay || 0;

        const startTime = Date.now();
        console.log(`Started at ${new Date().toLocaleTimeString()}`);
        console.log(`Processing ${resolved.urls.length} URLs (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        const results = await runRumBatch(resolved.urls, resolved.apiKey, resolved.categories, {
            concurrency,
            delayMs,
            onProgress(completed, total, targetUrl, error) {
                const pct = Math.round((completed / total) * 100);
                process.stderr.write(`\x1B[2K\r${pct}% [${completed}/${total}] done`);
                if (error) {
                    process.stderr.write(`\n  Failed: ${targetUrl} — ${error}\n`);
                }
            },
        });
        process.stderr.write('\n');

        const succeeded = results.filter((r) => !r.error);
        const failed = results.filter((r) => r.error);

        succeeded.forEach((r) => console.log(`  ${r.outputPath}`));
        console.log(`\nResults: ${succeeded.length} succeeded, ${failed.length} failed`);
        console.log(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

        if (failed.length > 0) {
            console.error('\nFailed:');
            failed.forEach((r) => console.error(`  - ${r.url}: ${r.error}`));
            process.exit(1);
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function collectAction(url, options) {
    try {
        const { promptCollect } = require('../lib/prompts');
        const { runCollect } = require('../lib/collect');
        const resolved = await promptCollect(url, options);
        console.log(`Collecting CrUX data for: ${resolved.url}`);
        const outputPath = await runCollect(resolved.url, resolved.cruxAuth);
        console.log(`Collect results saved to: ${outputPath}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function collectHistoryAction(url, options) {
    try {
        const { promptCollectHistory } = require('../lib/prompts');
        const { runCollectHistory } = require('../lib/collect-history');
        const resolved = await promptCollectHistory(url, options);
        console.log(`Collecting historical CrUX data for: ${resolved.url}`);
        const outputPath = await runCollectHistory(resolved.url, resolved.cruxAuth, resolved.since);
        console.log(`Collect-history results saved to: ${outputPath}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function sitemapAction(url, options) {
    try {
        const { promptSitemap } = require('../lib/prompts');
        const { runSitemap } = require('../lib/sitemap');
        const resolved = await promptSitemap(url, options);
        console.log(`Extracting sitemap URLs for: ${resolved.url}`);
        const outputPath = await runSitemap(resolved.url, resolved.depth, resolved.sitemapUrl, resolved.delay);
        console.log(`Sitemap results saved to: ${outputPath}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function linksAction(url) {
    try {
        const { promptLinks } = require('../lib/prompts');
        const { runLinks } = require('../lib/links');
        const resolved = await promptLinks(url);
        console.log(`Extracting links from: ${resolved}`);
        const outputPath = await runLinks(resolved);
        console.log(`Links results saved to: ${outputPath}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function wizardMode() {
    try {
        const { promptForSubcommand } = require('../lib/prompts');
        const command = await promptForSubcommand();
        const actions = {
            lab: () => labAction(undefined, {}),
            rum: () => rumAction(undefined, {}),
            collect: () => collectAction(undefined, {}),
            'collect-history': () => collectHistoryAction(undefined, {}),
            sitemap: () => sitemapAction(undefined, {}),
            links: () => linksAction(undefined),
        };
        await actions[command]();
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

program
    .name(name)
    .version(version)
    .description('Analyze web performance via Lighthouse, PageSpeed Insights, CrUX BigQuery, or sitemap extraction')
    .addHelpText('after', `
Environment variables:
  WEB_PERF_PSI_API_KEY       PageSpeed Insights API key (for rum)
  WEB_PERF_PSI_API_KEY_PATH  Path to file containing the PSI API key (for rum)
  WEB_PERF_CRUX_KEY_PATH     Path to BigQuery service account JSON (for collect/collect-history)
  WEB_PERF_CRUX_KEY          BigQuery service account JSON content (for collect/collect-history)

Examples:
  $ web-perf lab https://example.com
  $ web-perf lab --profile=low https://example.com
  $ web-perf rum --api-key=KEY https://example.com
  $ web-perf collect --api-key-path=sa.json https://example.com
  $ web-perf sitemap https://example.com
  $ web-perf                              (interactive wizard)
`);

program
    .command('lab')
    .description('Run a local Lighthouse audit')
    .argument('[url]', 'Full URL to audit (e.g. https://example.com)')
    .option('--profile <preset>', 'Simulation profile(s): low, medium, high, native, all (comma-separated)')
    .option('--network <preset>', 'Network throttling: 3g-slow, 3g, 4g, 4g-fast, wifi, none')
    .option('--device <preset>', 'Device emulation: moto-g-power, iphone-12, iphone-14, ipad, desktop, desktop-large')
    .option('--urls <urls>', 'Comma-separated list of URLs')
    .option('--urls-file <path>', 'Path to a file with one URL per line')
    .option('--skip-audits <audits>', 'Comma-separated audits to skip (default: full-page-screenshot,screenshot-thumbnails,final-screenshot,valid-source-maps)')
    .action(labAction);

program
    .command('rum')
    .description('Fetch data from PageSpeed Insights API')
    .argument('[url]', 'URL to analyze (ignored when --urls or --urls-file is provided)')
    .option('--api-key <key>', 'PSI API key inline (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing only the API key')
    .option('--urls <urls>', 'Comma-separated list of URLs')
    .option('--urls-file <path>', 'Path to a file with one URL per line')
    .option('--category <categories>', 'Lighthouse categories, comma-separated (default: all)')
    .option('--concurrency <n>', 'Max parallel API requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests per worker in ms (default: 0)', parseInt)
    .action(rumAction);

program
    .command('collect')
    .description('Extract CrUX data from BigQuery (origin-level)')
    .argument('[url]', 'Domain or origin to query (e.g. https://example.com)')
    .option('--api-key-path <path>', 'Path to BigQuery service account JSON (overrides WEB_PERF_CRUX_KEY_PATH/WEB_PERF_CRUX_KEY)')
    .action(collectAction);

program
    .command('collect-history')
    .description('Extract historical CrUX data from BigQuery')
    .argument('[url]', 'Domain or origin to query (e.g. https://example.com)')
    .option('--api-key-path <path>', 'Path to BigQuery service account JSON (overrides WEB_PERF_CRUX_KEY_PATH/WEB_PERF_CRUX_KEY)')
    .option('--since <date>', 'Start date YYYY-MM-DD (default: 12 months ago)')
    .action(collectHistoryAction);

program
    .command('sitemap')
    .description('Extract all URLs from domain sitemap.xml')
    .argument('[url]', 'Domain or URL to extract URLs from (e.g. example.com)')
    .option('--depth <n>', 'Max recursion depth for sitemap indexes (default: 3)', parseInt)
    .option('--sitemap-url <url>', 'Custom sitemap URL (default: <url>/sitemap.xml)')
    .option('--delay <ms>', 'Delay between requests in ms (randomized ±50ms)', parseInt)
    .action(sitemapAction);

program
    .command('links')
    .description('Extract internal links from rendered DOM (SPA-compatible)')
    .argument('[url]', 'URL to extract links from')
    .action(linksAction);

program.command('list-profiles').description('List available simulation profiles').action(() => {
    const { printProfiles } = require('../lib/profiles');
    printProfiles();
});
program.command('list-networks').description('List available network presets').action(() => {
    const { printNetworks } = require('../lib/profiles');
    printNetworks();
});
program.command('list-devices').description('List available device presets').action(() => {
    const { printDevices } = require('../lib/profiles');
    printDevices();
});

program.action(() => {
    wizardMode();
});

program.parse(process.argv);
