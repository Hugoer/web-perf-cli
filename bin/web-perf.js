#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const { runCollect } = require('../lib/collect');
const { runCollectHistory } = require('../lib/collect-history');
const { runLab } = require('../lib/lab');
const { runLinks } = require('../lib/links');
const { printProfiles, printNetworks, printDevices } = require('../lib/profiles');
const { runRum } = require('../lib/rum');
const { runSitemap } = require('../lib/sitemap');
const { name, version } = require('../package.json');

function resolveCruxAuth(apiKeyPath) {
    if (apiKeyPath) {
        return { keyFilename: apiKeyPath };
    }
    if (process.env.WEB_PERF_CRUX_KEY_PATH) {
        return { keyFilename: process.env.WEB_PERF_CRUX_KEY_PATH };
    }
    if (process.env.WEB_PERF_CRUX_KEY) {
        return { credentials: JSON.parse(process.env.WEB_PERF_CRUX_KEY) };
    }
    return null;
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
`);

program
    .command('lab')
    .description('Run a local Lighthouse audit')
    .argument('<url>', 'Full URL to audit (e.g. https://example.com)')
    .option('--profile <preset>', 'Simulation profile: low, medium, high')
    .option('--network <preset>', 'Network throttling: 3g-slow, 3g, 4g, 4g-fast, wifi, none')
    .option('--device <preset>', 'Device emulation: moto-g-power, iphone-12, iphone-14, ipad, desktop, desktop-large')
    .action(async (url, options) => {
        try {
            console.log(`Running Lighthouse audit for: ${url}`);
            const outputPath = await runLab(url, {
                profile: options.profile,
                network: options.network,
                device: options.device,
            });
            console.log(`Lab results saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program
    .command('rum')
    .description('Fetch data from PageSpeed Insights API')
    .argument('[url]', 'URL to analyze (ignored when --urls or --urls-file is provided)')
    .option('--api-key <key>', 'PSI API key inline (overrides WEB_PERF_PSI_API_KEY)')
    .option('--api-key-path <path>', 'Path to plain text file containing only the API key')
    .option('--urls <urls>', 'Comma-separated list of URLs')
    .option('--urls-file <path>', 'Path to a file with one URL per line')
    .option('--category <categories>', 'Lighthouse categories, comma-separated (default: all)')
    .action(async (url, options) => {
        try {
            let apiKey = options.apiKey;
            if (!apiKey && options.apiKeyPath) {
                apiKey = fs.readFileSync(options.apiKeyPath, 'utf-8').trim();
            }
            if (!apiKey && process.env.WEB_PERF_PSI_API_KEY) {
                apiKey = process.env.WEB_PERF_PSI_API_KEY;
            }
            if (!apiKey) {
                console.error('Error: Provide a PSI API key via --api-key, --api-key-path, or WEB_PERF_PSI_API_KEY env var.');
                process.exit(1);
            }
            const categories = options.category
                ? options.category.split(',').map((c) => c.trim().toUpperCase().replace(/-/g, '_'))
                : undefined;

            const urls = [];
            const hasUrlList = options.urls || options.urlsFile;
            if (url && !hasUrlList) {
                urls.push(url);
            }
            if (options.urls) {
                urls.push(...options.urls.split(',').map((u) => u.trim()).filter(Boolean));
            }
            if (options.urlsFile) {
                const fileContent = fs.readFileSync(options.urlsFile, 'utf-8');
                urls.push(...fileContent.split('\n').map((u) => u.trim()).filter(Boolean));
            }
            if (urls.length === 0) {
                console.error('Error: Provide at least one URL via argument, --urls, or --urls-file.');
                process.exit(1);
            }

            for (const targetUrl of urls) {
                console.log(`Fetching PageSpeed Insights for: ${targetUrl}`);
                const outputPath = await runRum(targetUrl, apiKey, categories); // eslint-disable-line no-await-in-loop
                console.log(`RUM results saved to: ${outputPath}`);
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program
    .command('collect')
    .description('Extract CrUX data from BigQuery (origin-level)')
    .argument('<url>', 'Domain or origin to query (e.g. https://example.com)')
    .option('--api-key-path <path>', 'Path to BigQuery service account JSON (overrides WEB_PERF_CRUX_KEY_PATH/WEB_PERF_CRUX_KEY)')
    .action(async (url, options) => {
        try {
            const cruxAuth = resolveCruxAuth(options.apiKeyPath);
            if (!cruxAuth) {
                console.error('Error: Provide BigQuery credentials via --api-key-path, WEB_PERF_CRUX_KEY_PATH, or WEB_PERF_CRUX_KEY env var.');
                process.exit(1);
            }
            console.log(`Collecting CrUX data for: ${url}`);
            const outputPath = await runCollect(url, cruxAuth);
            console.log(`Collect results saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program
    .command('collect-history')
    .description('Extract historical CrUX data from BigQuery')
    .argument('<url>', 'Domain or origin to query (e.g. https://example.com)')
    .option('--api-key-path <path>', 'Path to BigQuery service account JSON (overrides WEB_PERF_CRUX_KEY_PATH/WEB_PERF_CRUX_KEY)')
    .option('--since <date>', 'Start date YYYY-MM-DD (default: 12 months ago)')
    .action(async (url, options) => {
        try {
            const cruxAuth = resolveCruxAuth(options.apiKeyPath);
            if (!cruxAuth) {
                console.error('Error: Provide BigQuery credentials via --api-key-path, WEB_PERF_CRUX_KEY_PATH, or WEB_PERF_CRUX_KEY env var.');
                process.exit(1);
            }
            console.log(`Collecting historical CrUX data for: ${url}`);
            const outputPath = await runCollectHistory(url, cruxAuth, options.since);
            console.log(`Collect-history results saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program
    .command('sitemap')
    .description('Extract all URLs from domain sitemap.xml')
    .argument('<url>', 'Domain or URL to extract URLs from (e.g. example.com)')
    .option('--depth <n>', 'Max recursion depth for sitemap indexes (default: 3)', parseInt)
    .option('--sitemap-url <url>', 'Custom sitemap URL (default: <url>/sitemap.xml)')
    .action(async (url, options) => {
        try {
            console.log(`Extracting sitemap URLs for: ${url}`);
            const outputPath = await runSitemap(url, options.depth || 3, options.sitemapUrl);
            console.log(`Sitemap results saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program
    .command('links')
    .description('Extract internal links from rendered DOM (SPA-compatible)')
    .argument('<url>', 'URL to extract links from')
    .action(async (url) => {
        try {
            console.log(`Extracting links from: ${url}`);
            const outputPath = await runLinks(url);
            console.log(`Links results saved to: ${outputPath}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program.command('list-profiles').description('List available simulation profiles').action(() => printProfiles());
program.command('list-networks').description('List available network presets').action(() => printNetworks());
program.command('list-devices').description('List available device presets').action(() => printDevices());

program.parse(process.argv);
