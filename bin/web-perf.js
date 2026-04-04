#!/usr/bin/env node

const { program } = require('commander');

const { name, version } = require('../package.json');

async function labAction(url, options) {
    try {
        const chromeLauncher = require('chrome-launcher');
        const { promptLab, parseSkipAuditsFlag } = require('../lib/prompts');
        const { runLab, CHROME_FLAGS } = require('../lib/lab');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptLab(url, options);
        const skipAudits = parseSkipAuditsFlag(options.skipAudits) || resolved.skipAudits;

        const totalUrls = resolved.urls.length;
        const totalRuns = totalUrls * resolved.runs.length;
        const isBatch = totalUrls > 1;

        const startTime = Date.now();
        if (isBatch) {
            logger.header(`Started at ${new Date().toLocaleTimeString()}`);
            logger.header(`Processing ${totalUrls} URLs × ${resolved.runs.length} profile(s) = ${totalRuns} total runs\n`);
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
                        logger.progress(pct, runIndex, totalRuns, `${targetUrl} [profile: ${label}]`);
                    } else {
                        logger.action(`\nRunning Lighthouse audit for: ${targetUrl} [profile: ${label}]`);
                    }
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const outputPath = await runLab(targetUrl, { ...run, skipAudits, port: chrome.port, silent: isBatch });
                        results.push({ url: targetUrl, profile: label, outputPath });
                        if (!isBatch) {
                            const elapsed = formatElapsed(Date.now() - startTime);
                            logger.success(`Lab results saved to: ${outputPath} (${elapsed})`);
                        }
                    } catch (err) {
                        results.push({ url: targetUrl, profile: label, error: err.message });
                        if (isBatch) {
                            logger.fail(`${targetUrl} [${label}] — ${err.message}`);
                        } else {
                            throw err;
                        }
                    }
                }
            }

            if (!isBatch && resolved.runs.length > 1) {
                logger.footer(`\nCompleted ${resolved.runs.length} audits.`);
            }
        } finally {
            await chrome.kill();
        }

        if (isBatch) {
            process.stderr.write('\n');
            const succeeded = results.filter((r) => !r.error);
            const failed = results.filter((r) => r.error);

            succeeded.forEach((r) => logger.outputPath(r.outputPath));
            console.log('');
            logger.summary(succeeded.length, failed.length);
            logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

            if (failed.length > 0) {
                logger.failedList(failed.map((r) => `${r.url} [${r.profile}]: ${r.error}`));
                process.exit(1);
            }
        }
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function rumAction(url, options) {
    try {
        const { promptRum, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptRum(url, options);

        const categoryLabels = (resolved.categories || []).map((c) => c.toLowerCase().replace(/_/g, '-'));

        if (resolved.urls.length === 1) {
            const { runRum } = require('../lib/rum');
            logger.action(`Fetching PageSpeed Insights for: ${resolved.urls[0]}`);
            if (categoryLabels.length > 0) {
                logger.info(`Categories: ${categoryLabels.join(', ')}`);
            }
            const startTime = Date.now();
            const outputPath = await runRum(resolved.urls[0], resolved.apiKey, resolved.categories);
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`RUM results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runRumBatch } = require('../lib/rum');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        const startTime = Date.now();
        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        if (categoryLabels.length > 0) {
            logger.info(`Categories: ${categoryLabels.join(', ')}`);
        }
        console.log('');
        const results = await runRumBatch(resolved.urls, resolved.apiKey, resolved.categories, {
            concurrency,
            delayMs,
            onProgress(completed, total, targetUrl, error) {
                const pct = Math.round((completed / total) * 100);
                logger.progress(pct, completed, total, targetUrl);
                if (error) {
                    logger.fail(`${targetUrl} — ${error}`);
                }
            },
        });
        process.stderr.write('\n');

        const succeeded = results.filter((r) => !r.error);
        const failed = results.filter((r) => r.error);

        succeeded.forEach((r) => logger.outputPath(r.outputPath));
        console.log('');
        logger.summary(succeeded.length, failed.length);
        logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

        if (failed.length > 0) {
            logger.failedList(failed.map((r) => `${r.url}: ${r.error}`));
            process.exit(1);
        }
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

function normalizeUrlsForOriginScope(logger, resolved) {
    if (resolved.scope !== 'origin') {
        return;
    }
    const { normalizeOrigin } = require('../lib/collect');
    resolved.urls = resolved.urls.map((u) => {
        const origin = normalizeOrigin(u);
        const full = u.startsWith('http') ? u : `https://${u}`;
        if (full.replace(/\/+$/, '') !== origin) {
            logger.info(`URL normalized to origin: ${u} → ${origin}`);
        }
        return origin;
    });
}

async function collectAction(url, options) {
    try {
        const { promptCollect, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptCollect(url, options);

        normalizeUrlsForOriginScope(logger, resolved);

        const startTime = Date.now();

        if (resolved.urls.length === 1) {
            const { runCruxApi } = require('../lib/collect');
            logger.action(`Querying CrUX API (${resolved.scope}) for: ${resolved.urls[0]}`);
            const outputPath = await runCruxApi(resolved.urls[0], resolved.apiKey, { scope: resolved.scope });
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`Collect results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runCruxApiBatch } = require('../lib/collect');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs via CrUX API [${resolved.scope}] (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        console.log('');
        const results = await runCruxApiBatch(resolved.urls, resolved.apiKey, {
            scope: resolved.scope,
            concurrency,
            delayMs,
            onProgress(completed, total, targetUrl, error) {
                const pct = Math.round((completed / total) * 100);
                logger.progress(pct, completed, total, targetUrl);
                if (error) {
                    logger.fail(`${targetUrl} — ${error}`);
                }
            },
        });
        process.stderr.write('\n');

        const succeeded = results.filter((r) => !r.error);
        const failed = results.filter((r) => r.error);

        succeeded.forEach((r) => logger.outputPath(r.outputPath));
        console.log('');
        logger.summary(succeeded.length, failed.length);
        logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

        if (failed.length > 0) {
            logger.failedList(failed.map((r) => `${r.url}: ${r.error}`));
            process.exit(1);
        }
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function collectHistoryAction(url, options) {
    try {
        const { promptCollectHistory, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptCollectHistory(url, options);

        normalizeUrlsForOriginScope(logger, resolved);

        const startTime = Date.now();

        if (resolved.urls.length === 1) {
            const { runCruxHistoryApi } = require('../lib/collect');
            logger.action(`Querying CrUX History API (${resolved.scope}) for: ${resolved.urls[0]}`);
            const outputPath = await runCruxHistoryApi(resolved.urls[0], resolved.apiKey, { scope: resolved.scope });
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`Collect-history results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runCruxHistoryApiBatch } = require('../lib/collect');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs via CrUX History API [${resolved.scope}] (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        console.log('');
        const results = await runCruxHistoryApiBatch(resolved.urls, resolved.apiKey, {
            scope: resolved.scope,
            concurrency,
            delayMs,
            onProgress(completed, total, targetUrl, error) {
                const pct = Math.round((completed / total) * 100);
                logger.progress(pct, completed, total, targetUrl);
                if (error) {
                    logger.fail(`${targetUrl} — ${error}`);
                }
            },
        });
        process.stderr.write('\n');

        const succeeded = results.filter((r) => !r.error);
        const failed = results.filter((r) => r.error);

        succeeded.forEach((r) => logger.outputPath(r.outputPath));
        console.log('');
        logger.summary(succeeded.length, failed.length);
        logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);

        if (failed.length > 0) {
            logger.failedList(failed.map((r) => `${r.url}: ${r.error}`));
            process.exit(1);
        }
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function sitemapAction(url, options) {
    try {
        const { promptSitemap } = require('../lib/prompts');
        const { runSitemap } = require('../lib/sitemap');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptSitemap(url, options);
        logger.action(`Extracting sitemap URLs for: ${resolved.url}`);
        const startTime = Date.now();
        const outputPath = await runSitemap(resolved.url, resolved.depth, resolved.sitemapUrl, resolved.delay);
        const elapsed = formatElapsed(Date.now() - startTime);
        logger.success(`Sitemap results saved to: ${outputPath} (${elapsed})`);
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function linksAction(url) {
    try {
        const { promptLinks } = require('../lib/prompts');
        const { runLinks } = require('../lib/links');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptLinks(url);
        logger.action(`Extracting links from: ${resolved}`);
        const startTime = Date.now();
        const outputPath = await runLinks(resolved);
        const elapsed = formatElapsed(Date.now() - startTime);
        logger.success(`Links results saved to: ${outputPath} (${elapsed})`);
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
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
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

program
    .name(name)
    .version(version)
    .description('Analyze web performance via Lighthouse, PageSpeed Insights, CrUX API, or sitemap extraction')
    .addHelpText('after', `
Environment variables:
  WEB_PERF_PSI_API_KEY       API key for PageSpeed Insights / CrUX API (for rum, collect, collect-history)
  WEB_PERF_PSI_API_KEY_PATH  Path to file containing the API key (for rum, collect, collect-history)

Examples:
  $ web-perf lab https://example.com
  $ web-perf lab --profile=low https://example.com
  $ web-perf rum --api-key=KEY https://example.com
  $ web-perf collect --api-key=KEY https://example.com
  $ web-perf collect-history --api-key=KEY https://example.com
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
    .description('Extract CrUX data via CrUX API (origin or page-level, 28-day rolling average)')
    .argument('[url]', 'URL or origin to query')
    .option('--scope <scope>', 'Query scope: origin or page (default: origin)', 'origin')
    .option('--api-key <key>', 'CrUX API key (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing the API key')
    .option('--urls <urls>', 'Comma-separated URLs (page scope)')
    .option('--urls-file <path>', 'Path to file with one URL per line (page scope)')
    .option('--concurrency <n>', 'Max parallel requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests in ms (default: 0)', parseInt)
    .action(collectAction);

program
    .command('collect-history')
    .description('Extract historical CrUX data via CrUX API (~6 months of weekly data points)')
    .argument('[url]', 'URL or origin to query (e.g. https://example.com)')
    .option('--scope <scope>', 'Query scope: origin or page (default: origin)', 'origin')
    .option('--api-key <key>', 'CrUX API key (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing the API key')
    .option('--urls <urls>', 'Comma-separated URLs (page scope)')
    .option('--urls-file <path>', 'Path to file with one URL per line (page scope)')
    .option('--concurrency <n>', 'Max parallel requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests in ms (default: 0)', parseInt)
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
