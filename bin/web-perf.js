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

async function labAction(url, options, cmd) {
    const {
        promptLab, parseSkipAuditsFlag, parseBlockedUrlPatternsFlag, parseRunsFlag,
    } = require('../lib/prompts');
    const { runLabPlan } = require('../lib/lab');
    const { formatRunLine, formatSummaryLine } = require('../lib/variance');
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
    const stripJsonPropsOpt = cmd?.getOptionValueSource('stripJsonProps') === 'cli' ? options.stripJsonProps : undefined;
    const cleanOpt = cmd?.getOptionValueSource('clean') === 'cli' ? options.clean : undefined;
    const { LAB_CATEGORIES } = require('../lib/profiles');
    // Validate flag combinations before any prompting or browser work.
    const reuseBrowser = options.reuseBrowser === true;
    const repeats = parseRunsFlag(options.runs, { reuseBrowser });
    const resolved = await promptLab(url, { ...options, stripJsonProps: stripJsonPropsOpt, clean: cleanOpt });
    const skipAudits = parseSkipAuditsFlag(options.skipAudits) || resolved.skipAudits;
    const blockedUrlPatterns = parseBlockedUrlPatternsFlag(options.blockedUrlPatterns) || resolved.blockedUrlPatterns;
    // promptLab always sets resolved.categories (parsed from --category or the checkbox)
    const categories = resolved.categories || [];
    const stripJsonProps = resolved.stripJsonProps ?? options.stripJsonProps;
    const clean = resolved.clean ?? false;

    if (categories.length > 0 && categories.length < LAB_CATEGORIES.length) {
        logger.info(`Categories: ${categories.join(', ')}`);
    }

    const totalUrls = resolved.urls.length;
    const totalRuns = totalUrls * resolved.runs.length * repeats;
    const isBatch = totalUrls > 1;
    const isRepeating = repeats > 1;

    if (reuseBrowser && totalRuns > 1) {
        logger.warn('--reuse-browser keeps DNS caches and socket pools warm between runs, so later runs score better than earlier ones. Scores are not comparable across this plan.');
    }

    const startTime = Date.now();
    if (isBatch || isRepeating) {
        logger.header(`Started at ${new Date().toLocaleTimeString()}`);
        const plan = `${totalUrls} URL(s) × ${resolved.runs.length} profile(s)${isRepeating ? ` × ${repeats} run(s)` : ''}`;
        const summaryCount = totalUrls * resolved.runs.length;
        const files = isRepeating
            ? `${totalRuns} reports + ${summaryCount} ${summaryCount === 1 ? 'summary' : 'summaries'}`
            : `${totalRuns} reports`;
        logger.header(`Processing ${plan} = ${totalRuns} total runs (${files})\n`);
    }

    const results = await runLabPlan(
        resolved.urls,
        resolved.runs,
        {
            skipAudits,
            blockedUrlPatterns,
            categories,
            stripJsonProps,
            clean,
            silent: isBatch || isRepeating,
            // Repeat sampling tolerates a flaky run: aborting would discard the runs that
            // did succeed and produce no summary, which is the opposite of the point.
            continueOnError: isBatch || isRepeating,
            reuseBrowser,
            repeats,
        },
        {
            onRunStart: ({ url: runUrl, profile, runIndex, totalRuns: total }) => {
                if (isBatch) {
                    logger.progress(Math.round((runIndex / total) * 100), runIndex, total, `${runUrl} [profile: ${profile}]`);
                } else if (!isRepeating) {
                    logger.action(`\nRunning Lighthouse audit for: ${runUrl} [profile: ${profile}]`);
                }
            },
            onRunComplete: ({ outputPath, report, repeat }) => {
                if (isBatch) {
                    return;
                }
                if (isRepeating) {
                    logger.info(`run ${repeat}/${repeats}  ${formatRunLine(report)}`);
                } else {
                    logger.success(`Lab results saved to: ${outputPath} (${formatElapsed(Date.now() - startTime)})`);
                }
            },
            onRunError: ({ url: runUrl, profile, error }) => {
                logger.fail(`${runUrl} [${profile}] — ${error}`);
            },
            onSummary: ({ url: runUrl, profile, summary, summaryPath }) => {
                if (isBatch) {
                    process.stderr.write('\n');
                    logger.info(`${runUrl} [${profile}]  ${formatSummaryLine(summary)}`);
                } else {
                    logger.footer(`\n  ${formatSummaryLine(summary)}`);
                }
                summary.stability.warnings.forEach((w) => logger.warn(w));
                logger.outputPath(summaryPath);
            },
        },
    );

    if (!isBatch && resolved.runs.length > 1) {
        logger.footer(`\nCompleted ${resolved.runs.length} audits.`);
    }

    const succeeded = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    if (isBatch) {
        process.stderr.write('\n');
        succeeded.forEach((r) => logger.outputPath(r.outputPath));
        console.log('');
        logger.summary(succeeded.length, failed.length);
        logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);
    }

    // A single-URL repeat plan now survives a failed run instead of throwing, so the
    // non-zero exit has to be raised here rather than by the outer catch.
    if (failed.length > 0) {
        logger.failedList(failed.map((r) => `${r.url} [${r.profile}]: ${r.error}`));
        process.exit(1);
    }
}

function runCruxBatchSummary(results, startTime) {
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
    process.stderr.write('\n');
    // A CrUX 404 means the page is not in the dataset — reported, but not a failed run.
    const noData = results.filter((r) => r.noData);
    const failed = results.filter((r) => r.error);
    const succeeded = results.filter((r) => !r.error && !r.noData);
    succeeded.forEach((r) => logger.outputPath(r.outputPath));
    console.log('');
    logger.summary(succeeded.length, failed.length, noData.length);
    logger.footer(`Finished at ${new Date().toLocaleTimeString()} (${formatElapsed(Date.now() - startTime)})`);
    if (noData.length > 0) {
        logger.noDataList(noData.map((r) => `${r.url} [${r.formFactor}]`));
    }
    if (failed.length > 0) {
        logger.failedList(failed.map((r) => `${r.url} [${r.formFactor}]: ${r.error}`));
        process.exit(1);
    }
}

function runPsiBatchSummary(results, startTime) {
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
        logger.failedList(failed.map((r) => `${r.url} [${r.strategy}]: ${r.error}`));
        process.exit(1);
    }
}

async function psiAction(url, options) {
    const { promptPsi, DEFAULT_CONCURRENCY } = require('../lib/prompts');
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
    const resolved = await promptPsi(url, options);

    const categoryLabels = (resolved.categories || []).map((c) => c.toLowerCase().replace(/_/g, '-'));
    const strategies = resolved.strategies;
    const psiClean = resolved.clean ?? false;

    if (resolved.urls.length === 1) {
        const { runPsi } = require('../lib/psi');
        logger.action(`Fetching PageSpeed Insights for: ${resolved.urls[0]} [${strategies.join(', ')}]`);
        if (categoryLabels.length > 0) {
            logger.info(`Categories: ${categoryLabels.join(', ')}`);
        }
        const startTime = Date.now();
        const outputPaths = await runPsi(resolved.urls[0], resolved.apiKey, resolved.categories, { clean: psiClean, strategies });
        const elapsed = formatElapsed(Date.now() - startTime);
        outputPaths.forEach((p) => logger.success(`PSI results saved to: ${p}`));
        logger.footer(`(${elapsed})`);
        return;
    }

    const { runPsiBatch } = require('../lib/psi');
    const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
    const delayMs = resolved.delay || 0;
    const totalRequests = resolved.urls.length * strategies.length;

    const startTime = Date.now();
    logger.header(`Started at ${new Date().toLocaleTimeString()}`);
    logger.header(`Processing ${resolved.urls.length} URLs × ${strategies.length} strategies = ${totalRequests} PSI requests (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
    logger.info(`Strategies: ${strategies.join(', ')}`);
    if (categoryLabels.length > 0) {
        logger.info(`Categories: ${categoryLabels.join(', ')}`);
    }
    console.log('');
    const results = await runPsiBatch(resolved.urls, resolved.apiKey, resolved.categories, {
        concurrency,
        delayMs,
        clean: psiClean,
        strategies,
        onProgress(completed, total, targetUrl, error) {
            const pct = Math.round((completed / total) * 100);
            logger.progress(pct, completed, total, targetUrl);
            if (error) {
                logger.fail(`${targetUrl} — ${error}`);
            }
        },
    });
    runPsiBatchSummary(results, startTime);
}

function normalizeUrlsForOriginScope(logger, resolved) {
    if (resolved.scope !== 'origin') {
        return;
    }
    const { normalizeUrlsToOrigins } = require('../lib/utils');
    const { origins, normalized, duplicatesRemoved } = normalizeUrlsToOrigins(resolved.urls);
    normalized.forEach(({ from, to }) => logger.info(`URL normalized to origin: ${from} → ${to}`));
    if (duplicatesRemoved > 0) {
        logger.info(`Origin normalization: ${duplicatesRemoved} duplicate origin(s) removed`);
    }
    resolved.urls = origins;
}

async function cruxAction(url, options) {
    const { promptCrux, DEFAULT_CONCURRENCY } = require('../lib/prompts');
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
    const resolved = await promptCrux(url, options);

    normalizeUrlsForOriginScope(logger, resolved);

    const formFactors = resolved.formFactors;
    const startTime = Date.now();

    if (resolved.urls.length === 1) {
        const { runCrux } = require('../lib/crux');
        logger.action(`Querying CrUX API (${resolved.scope}) for: ${resolved.urls[0]} [${formFactors.join(', ')}]`);
        const outputPaths = await runCrux(resolved.urls[0], resolved.apiKey, {
            scope: resolved.scope,
            formFactors,
            onNoData: (_formFactor, message) => logger.warn(message),
        });
        const elapsed = formatElapsed(Date.now() - startTime);
        outputPaths.forEach((p) => logger.success(`CrUX results saved to: ${p}`));
        logger.footer(`(${elapsed})`);
        return;
    }

    const { runCruxBatch } = require('../lib/crux');
    const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
    const delayMs = resolved.delay || 0;
    const totalRequests = resolved.urls.length * formFactors.length;

    logger.header(`Started at ${new Date().toLocaleTimeString()}`);
    logger.header(`Processing ${resolved.urls.length} URLs × ${formFactors.length} form factors = ${totalRequests} CrUX requests (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
    logger.info(`Form factors: ${formFactors.join(', ')}`);
    console.log('');
    const results = await runCruxBatch(resolved.urls, resolved.apiKey, {
        scope: resolved.scope,
        concurrency,
        delayMs,
        formFactors,
        onProgress(completed, total, targetUrl, error, statusCode) {
            const pct = Math.round((completed / total) * 100);
            logger.progress(pct, completed, total, targetUrl);
            // 404 is "not in the CrUX dataset", reported in the summary rather than
            // inline as a failure.
            if (error && statusCode !== 404) {
                logger.fail(`${targetUrl} — ${error}`);
            }
        },
    });
    runCruxBatchSummary(results, startTime);
}

async function cruxHistoryAction(url, options) {
    const { promptCruxHistory, DEFAULT_CONCURRENCY } = require('../lib/prompts');
    const { formatElapsed } = require('../lib/utils');
    const logger = require('../lib/logger');
    const resolved = await promptCruxHistory(url, options);

    normalizeUrlsForOriginScope(logger, resolved);

    const formFactors = resolved.formFactors;
    const startTime = Date.now();

    if (resolved.urls.length === 1) {
        const { runCruxHistory } = require('../lib/crux-history');
        logger.action(`Querying CrUX History API (${resolved.scope}) for: ${resolved.urls[0]} [${formFactors.join(', ')}]`);
        const outputPaths = await runCruxHistory(resolved.urls[0], resolved.apiKey, {
            scope: resolved.scope,
            formFactors,
            onNoData: (_formFactor, message) => logger.warn(message),
        });
        const elapsed = formatElapsed(Date.now() - startTime);
        outputPaths.forEach((p) => logger.success(`CrUX History results saved to: ${p}`));
        logger.footer(`(${elapsed})`);
        return;
    }

    const { runCruxHistoryBatch } = require('../lib/crux-history');
    const concurrency = resolved.concurrency || DEFAULT_CONCURRENCY;
    const delayMs = resolved.delay || 0;
    const totalRequests = resolved.urls.length * formFactors.length;

    logger.header(`Started at ${new Date().toLocaleTimeString()}`);
    logger.header(`Processing ${resolved.urls.length} URLs × ${formFactors.length} form factors = ${totalRequests} CrUX History requests (concurrency: ${concurrency}, delay: ${delayMs}ms)`);
    logger.info(`Form factors: ${formFactors.join(', ')}`);
    console.log('');
    const results = await runCruxHistoryBatch(resolved.urls, resolved.apiKey, {
        scope: resolved.scope,
        concurrency,
        delayMs,
        formFactors,
        onProgress(completed, total, targetUrl, error, statusCode) {
            const pct = Math.round((completed / total) * 100);
            logger.progress(pct, completed, total, targetUrl);
            // 404 is "not in the CrUX dataset", reported in the summary rather than
            // inline as a failure.
            if (error && statusCode !== 404) {
                logger.fail(`${targetUrl} — ${error}`);
            }
        },
    });
    runCruxBatchSummary(results, startTime);
}

async function sitemapAction(url, options) {
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
}

async function linksAction(url, options) {
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
}

async function cleanAction(input) {
    const { promptClean } = require('../lib/prompts');
    const { runCleanCmd } = require('../lib/clean-cmd');
    const logger = require('../lib/logger');
    // The subcommand supplies the input as an argument; the wizard has to ask for it.
    const target = input ?? (await promptClean()).input;
    const { cleaned, skipped, errored } = await runCleanCmd(target);
    logger.summary(cleaned.length, errored.length);
    logger.info(`cleaned: ${cleaned.length}, skipped: ${skipped.length}, errored: ${errored.length}`);
    if (errored.length > 0) {
        process.exit(1);
    }
}

async function wizardMode() {
    const { promptForSubcommand } = require('../lib/prompts');
    const command = await promptForSubcommand();
    const actions = {
        lab: () => labAction(undefined, {}),
        psi: () => psiAction(undefined, {}),
        crux: () => cruxAction(undefined, {}),
        'crux-history': () => cruxHistoryAction(undefined, {}),
        sitemap: () => sitemapAction(undefined, {}),
        links: () => linksAction(undefined),
        clean: () => cleanAction(),
    };
    await actions[command]();
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
    .option('--category <categories>', 'Lighthouse categories, comma-separated: performance, accessibility, best-practices, seo, agentic-browsing (default: all)')
    .option('--no-strip-json-props', 'Disable stripping of unneeded properties (i18n, timing) from JSON output')
    .option('--clean', 'Write an AI-friendly clean copy to results/lab/clean/ alongside the raw file')
    .option('--reuse-browser', 'Share one Chrome across all runs instead of launching a fresh one per run. Faster, but results become order-dependent because connection pools stay warm between runs')
    .option('--runs <n>', 'Audits per URL per profile (default: 1). Above 1, each run gets a -runNN suffix and a .summary.json records median, spread and benchmarkIndex range', parseInt)
    .action(withCatch(labAction));

program
    .command('psi')
    .description('Fetch data from PageSpeed Insights API')
    .argument('[url]', 'URL to analyze (ignored when --urls or --urls-file is provided)')
    .option('--api-key <key>', 'PSI API key inline (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing only the API key')
    .option('--urls <urls>', 'Comma-separated list of URLs')
    .option('--urls-file <path>', 'Path to a file with one URL per line')
    .option('--strategy <strategies>', 'Comma-separated PSI strategies: mobile, desktop (default: mobile,desktop)')
    .option('--category <categories>', 'Lighthouse categories, comma-separated (default: all)')
    .option('--concurrency <n>', 'Max parallel API requests (default: 5)', parseInt)
    .option('--delay <ms>', 'Delay between requests per worker in ms (default: 0)', parseInt)
    .option('--clean', 'Write an AI-friendly clean copy to results/psi/clean/ alongside the raw file')
    .action(withCatch(psiAction));

program
    .command('crux')
    .description('Extract CrUX data via CrUX API (origin or page-level, 28-day rolling average)')
    .argument('[url]', 'URL or origin to query')
    .option('--scope <scope>', 'Query scope: origin or page (default: origin; URL lists default to page)')
    .option('--form-factor <form-factors>', 'Comma-separated form factors: phone, desktop, tablet (default: phone,desktop)')
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
    .option('--form-factor <form-factors>', 'Comma-separated form factors: phone, desktop, tablet (default: phone,desktop)')
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

program
    .command('clean')
    .description('Generate AI-friendly .clean.json files from existing lab or psi outputs')
    .argument('<input>', 'File path, directory, or glob pattern (e.g. results/lab/ or "results/**/*.json")')
    .addHelpText('after', `
Examples:
  $ web-perf clean results/lab/lab-example.com.json
  $ web-perf clean results/lab/
  $ web-perf clean 'results/**/*.json'
`)
    .action(withCatch(cleanAction));

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
