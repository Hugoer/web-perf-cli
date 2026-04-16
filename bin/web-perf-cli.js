#!/usr/bin/env node

const { program } = require('commander');

const { name, version } = require('../package.json');

function withCatch(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (err) {
            const logger = require('../lib/logger');
            logger.error(`Error: ${err.message}`);
            process.exit(1);
        }
    };
}

function runBatchAction(results, startTime) {
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
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
}

async function labAction(url, options, cmd) {
    try {
        const chromeLauncher = require('chrome-launcher');
        const { promptLab, parseSkipAuditsFlag, parseBlockedUrlPatternsFlag } = require('../lib/prompts');
        const { runLab, CHROME_FLAGS } = require('../lib/lab');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const stripJsonPropsOpt = cmd?.getOptionValueSource('stripJsonProps') === 'cli' ? options.stripJsonProps : undefined;
        const resolved = await promptLab(url, { ...options, stripJsonProps: stripJsonPropsOpt });
        const skipAudits = parseSkipAuditsFlag(options.skipAudits) || resolved.skipAudits;
        const blockedUrlPatterns = parseBlockedUrlPatternsFlag(options.blockedUrlPatterns) || resolved.blockedUrlPatterns;
        const stripJsonProps = resolved.stripJsonProps ?? options.stripJsonProps;

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
                        const outputPath = await runLab(targetUrl, { ...run, skipAudits, blockedUrlPatterns, stripJsonProps, port: chrome.port, silent: isBatch });
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

async function psiAction(url, options) {
    try {
        const { promptPsi, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptPsi(url, options);

        const categoryLabels = (resolved.categories || []).map((c) => c.toLowerCase().replace(/_/g, '-'));

        if (resolved.urls.length === 1) {
            const { runPsi } = require('../lib/psi');
            logger.action(`Fetching PageSpeed Insights for: ${resolved.urls[0]}`);
            if (categoryLabels.length > 0) {
                logger.info(`Categories: ${categoryLabels.join(', ')}`);
            }
            const startTime = Date.now();
            const outputPath = await runPsi(resolved.urls[0], resolved.apiKey, resolved.categories);
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`PSI results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runPsiBatch } = require('../lib/psi');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        const startTime = Date.now();
        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        if (categoryLabels.length > 0) {
            logger.info(`Categories: ${categoryLabels.join(', ')}`);
        }
        console.log('');
        const results = await runPsiBatch(resolved.urls, resolved.apiKey, resolved.categories, {
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
        runBatchAction(results, startTime);
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
    const { normalizeOrigin } = require('../lib/utils');
    resolved.urls = resolved.urls.map((u) => {
        const origin = normalizeOrigin(u);
        const full = u.startsWith('http') ? u : `https://${u}`;
        if (full.replace(/\/+$/, '') !== origin) {
            logger.info(`URL normalized to origin: ${u} → ${origin}`);
        }
        return origin;
    });
}

async function cruxAction(url, options) {
    try {
        const { promptCrux, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptCrux(url, options);

        normalizeUrlsForOriginScope(logger, resolved);

        const startTime = Date.now();

        if (resolved.urls.length === 1) {
            const { runCrux } = require('../lib/crux');
            logger.action(`Querying CrUX API (${resolved.scope}) for: ${resolved.urls[0]}`);
            const outputPath = await runCrux(resolved.urls[0], resolved.apiKey, { scope: resolved.scope });
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`CrUX results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runCruxBatch } = require('../lib/crux');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs via CrUX API [${resolved.scope}] (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        console.log('');
        const results = await runCruxBatch(resolved.urls, resolved.apiKey, {
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
        runBatchAction(results, startTime);
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function cruxHistoryAction(url, options) {
    try {
        const { promptCruxHistory, DEFAULT_CONCURRENCY } = require('../lib/prompts');
        const { formatElapsed } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptCruxHistory(url, options);

        normalizeUrlsForOriginScope(logger, resolved);

        const startTime = Date.now();

        if (resolved.urls.length === 1) {
            const { runCruxHistory } = require('../lib/crux-history');
            logger.action(`Querying CrUX History API (${resolved.scope}) for: ${resolved.urls[0]}`);
            const outputPath = await runCruxHistory(resolved.urls[0], resolved.apiKey, { scope: resolved.scope });
            const elapsed = formatElapsed(Date.now() - startTime);
            logger.success(`CrUX History results saved to: ${outputPath} (${elapsed})`);
            return;
        }

        const { runCruxHistoryBatch } = require('../lib/crux-history');
        const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
        const delayMs = resolved.delay || 0;

        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        logger.header(`Processing ${resolved.urls.length} URLs via CrUX History API [${resolved.scope}] (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
        console.log('');
        const results = await runCruxHistoryBatch(resolved.urls, resolved.apiKey, {
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
        runBatchAction(results, startTime);
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
        const { formatElapsed, writeAiOutput } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptSitemap(url, options);
        logger.action(`Extracting sitemap URLs for: ${resolved.url}`);
        const startTime = Date.now();
        const { outputPath, urls } = await runSitemap(resolved.url, resolved.depth, resolved.delay);
        const elapsed = formatElapsed(Date.now() - startTime);
        logger.success(`Sitemap results saved to: ${outputPath} (${elapsed})`);
        if (resolved.outputAi) {
            const aiPath = writeAiOutput(urls, resolved.url, 'sitemap');
            logger.success(`AI-friendly output saved to: ${aiPath}`);
        }
    } catch (err) {
        const logger = require('../lib/logger');
        logger.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function linksAction(url, options) {
    try {
        const { promptLinks } = require('../lib/prompts');
        const { runLinks } = require('../lib/links');
        const { formatElapsed, writeAiOutput } = require('../lib/utils');
        const logger = require('../lib/logger');
        const resolved = await promptLinks(url, options);
        logger.action(`Extracting links from: ${resolved.url}`);
        const startTime = Date.now();
        const { outputPath, links } = await runLinks(resolved.url);
        const elapsed = formatElapsed(Date.now() - startTime);
        logger.success(`Links results saved to: ${outputPath} (${elapsed})`);
        if (resolved.outputAi) {
            const urls = links.map((l) => l.href);
            const aiPath = writeAiOutput(urls, resolved.url, 'links');
            logger.success(`AI-friendly output saved to: ${aiPath}`);
        }
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
            psi: () => psiAction(undefined, {}),
            crux: () => cruxAction(undefined, {}),
            'crux-history': () => cruxHistoryAction(undefined, {}),
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
  WEB_PERF_PSI_API_KEY       API key for PageSpeed Insights / CrUX API (for psi, crux, crux-history)
  WEB_PERF_PSI_API_KEY_PATH  Path to file containing the API key (for psi, crux, crux-history)

Examples:
  $ web-perf lab https://example.com
  $ web-perf lab --profile=low https://example.com
  $ web-perf psi --api-key=KEY https://example.com
  $ web-perf crux --api-key=KEY https://example.com
  $ web-perf crux-history --api-key=KEY https://example.com
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
    .option('--blocked-url-patterns <patterns>', 'Comma-separated URL patterns to block during audit (e.g. *.google-analytics.com,*.facebook.net)')
    .option('--no-strip-json-props', 'Disable stripping of unneeded properties (i18n, timing) from JSON output')
    .action(withCatch(labAction));

program
    .command('psi')
    .description('Fetch data from PageSpeed Insights API')
    .argument('[url]', 'URL to analyze (ignored when --urls or --urls-file is provided)')
    .option('--api-key <key>', 'PSI API key inline (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing only the API key')
    .option('--urls <urls>', 'Comma-separated list of URLs')
    .option('--urls-file <path>', 'Path to a file with one URL per line')
    .option('--category <categories>', 'Lighthouse categories, comma-separated (default: all)')
    .option('--concurrency <n>', 'Max parallel API requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests per worker in ms (default: 0)', parseInt)
    .action(withCatch(psiAction));

program
    .command('crux')
    .description('Extract CrUX data via CrUX API (origin or page-level, 28-day rolling average)')
    .argument('[url]', 'URL or origin to query')
    .option('--scope <scope>', 'Query scope: origin or page (default: origin; URL lists default to page)')
    .option('--api-key <key>', 'CrUX API key (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing the API key')
    .option('--urls <urls>', 'Comma-separated URLs (page scope)')
    .option('--urls-file <path>', 'Path to file with one URL per line (page scope)')
    .option('--concurrency <n>', 'Max parallel requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests in ms (default: 0)', parseInt)
    .action(withCatch(cruxAction));

program
    .command('crux-history')
    .description('Extract historical CrUX data via CrUX API (~6 months of weekly data points)')
    .argument('[url]', 'URL or origin to query (e.g. https://example.com)')
    .option('--scope <scope>', 'Query scope: origin or page (default: origin; URL lists default to page)')
    .option('--api-key <key>', 'CrUX API key (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing the API key')
    .option('--urls <urls>', 'Comma-separated URLs (page scope)')
    .option('--urls-file <path>', 'Path to file with one URL per line (page scope)')
    .option('--concurrency <n>', 'Max parallel requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests in ms (default: 0)', parseInt)
    .action(withCatch(cruxHistoryAction));

program
    .command('sitemap')
    .description('Extract all URLs from sitemap.xml')
    .argument('[url]', 'Domain or sitemap URL (e.g. example.com or example.com/sitemap-pages.xml)')
    .option('--depth <n>', 'Max recursion depth for sitemap indexes (default: 3)', parseInt)
    .option('--delay <ms>', 'Delay between requests in ms (randomized ±50ms)', parseInt)
    .option('--output-ai', 'Generate AI-friendly .txt output (one URL per line, normalized)')
    .action(withCatch(sitemapAction));

program
    .command('links')
    .description('Extract internal links from rendered DOM (SPA-compatible)')
    .argument('[url]', 'URL to extract links from')
    .option('--output-ai', 'Generate AI-friendly .txt output (one URL per line, normalized)')
    .action(withCatch(linksAction));

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

program.action(withCatch(wizardMode));

program.parse(process.argv);
