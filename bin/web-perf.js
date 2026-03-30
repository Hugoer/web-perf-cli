#!/usr/bin/env node

const { program } = require('commander');
const { runCollect } = require('../lib/collect');
const { runCollectHistory } = require('../lib/collect-history');
const { runLab } = require('../lib/lab');
const { runLinks } = require('../lib/links');
const { printProfiles, printNetworks, printDevices } = require('../lib/profiles');
const { promptForSubcommand, promptLab, promptRum, promptCollect, promptCollectHistory, promptSitemap, promptLinks } = require('../lib/prompts');
const { runRum } = require('../lib/rum');
const { runSitemap } = require('../lib/sitemap');
const { name, version } = require('../package.json');

async function labAction(url, options) {
    try {
        const resolved = await promptLab(url, options);
        console.log(`Running Lighthouse audit for: ${resolved.url}`);
        const outputPath = await runLab(resolved.url, {
            profile: resolved.profile,
            network: resolved.network,
            device: resolved.device,
        });
        console.log(`Lab results saved to: ${outputPath}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function rumAction(url, options) {
    try {
        const resolved = await promptRum(url, options);

        for (const targetUrl of resolved.urls) {
            console.log(`Fetching PageSpeed Insights for: ${targetUrl}`);
            const outputPath = await runRum(targetUrl, resolved.apiKey, resolved.categories); // eslint-disable-line no-await-in-loop
            console.log(`RUM results saved to: ${outputPath}`);
        }
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

async function collectAction(url, options) {
    try {
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
  WEB_PERF_PSI_API_KEY     PageSpeed Insights API key (for rum)
  WEB_PERF_CRUX_KEY_PATH   Path to BigQuery service account JSON (for collect/collect-history)
  WEB_PERF_CRUX_KEY        BigQuery service account JSON content (for collect/collect-history)

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
    .option('--profile <preset>', 'Simulation profile: low, medium, high')
    .option('--network <preset>', 'Network throttling: 3g-slow, 3g, 4g, 4g-fast, wifi, none')
    .option('--device <preset>', 'Device emulation: moto-g-power, iphone-12, iphone-14, ipad, desktop, desktop-large')
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

program.command('list-profiles').description('List available simulation profiles').action(() => printProfiles());
program.command('list-networks').description('List available network presets').action(() => printNetworks());
program.command('list-devices').description('List available device presets').action(() => printDevices());

program.action(() => {
    wizardMode();
});

program.parse(process.argv);
