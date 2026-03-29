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

program
    .name(name)
    .version(version)
    .description('Analyze web performance via Lighthouse (lab), PageSpeed Insights (RUM), CrUX BigQuery (collect/collect-history), or sitemap extraction (sitemap)')
    .argument('[url]', 'URL or domain to analyze')
    .option('--lab', 'Run a local Lighthouse audit')
    .option('--rum', 'Fetch data from PageSpeed Insights API')
    .option('--collect', 'Extract CrUX data from BigQuery materialized tables')
    .option('--collect-history', 'Extract historical CrUX data from BigQuery')
    .option('--links', 'Extract internal links from the rendered DOM (supports SPAs)')
    .option('--sitemap', 'Extract all URLs from the domain sitemap.xml')
    .option('--depth <n>', 'Max depth for sitemap index recursion (--sitemap, default: 3)', parseInt)
    .option('--sitemap-url <url>', 'Custom sitemap URL (default: <url>/sitemap.xml)')
    .option('--api-key <key>', 'PageSpeed Insights API key inline (for --rum)')
    .option('--api-key-path <path>', 'Path to a key file: plain text with API key (for --rum) or service account JSON (for --collect/--collect-history)')
    .option('--since <date>', 'Start date for --collect-history (YYYY-MM-DD, default: 12 months ago)')
    .option('--urls <urls>', 'Comma-separated list of URLs (for --rum)')
    .option('--urls-file <path>', 'Path to a file with one URL per line (for --rum)')
    .option('--category <categories>', 'Lighthouse categories, comma-separated (--rum, default: all)')
    .option('--profile <preset>', 'Simulation profile for --lab (low, medium, high)')
    .option('--network <preset>', 'Network throttling preset for --lab (3g-slow, 3g, 4g, 4g-fast, wifi, none)')
    .option('--device <preset>', 'Device emulation preset for --lab (moto-g-power, iphone-12, iphone-14, ipad, desktop, desktop-large)')
    .option('--list-profiles', 'List all available simulation profiles')
    .option('--list-networks', 'List all available network presets')
    .option('--list-devices', 'List all available device presets')
    .addHelpText('after', `
Examples:
  $ web-perf --lab <url>
  $ web-perf --rum --api-key=<KEY> <url>
  $ web-perf --rum --urls=<u1>,<u2> --api-key=<KEY>
  $ web-perf --rum --urls-file=<path-to-file> --api-key=<KEY>
  $ web-perf --collect --api-key-path=<path-to-file> <url>
  $ web-perf --collect-history --api-key-path=<path-to-file> [--since=YYYY-MM-DD] <url>
  $ web-perf --links <url>
  $ web-perf --sitemap [--depth=N] <url>

  Lab profiles:
  $ web-perf --lab --profile=low <url>
  $ web-perf --lab --network=3g --device=iphone-12 <url>
  $ web-perf --lab --profile=low --network=wifi <url>
  $ web-perf --list-profiles

Notes:
  Modes are mutually exclusive — pick exactly one:
    --lab | --rum | --collect | --collect-history | --links | --sitemap
  In --rum mode, <url> is ignored when --urls or --urls-file is provided.
  --profile, --network, --device only apply to --lab mode.
  Results are saved to results/<mode>/.`)
    .action(async (url, options) => {
        try {
            if (options.listProfiles || options.listNetworks || options.listDevices) {
                if (options.listProfiles) {
                    printProfiles();
                }
                if (options.listNetworks) {
                    printNetworks();
                }
                if (options.listDevices) {
                    printDevices();
                }
                return;
            }

            const profileFlags = [options.profile, options.network, options.device].filter(Boolean);
            if (profileFlags.length > 0 && !options.lab) {
                console.warn('Warning: --profile, --network, and --device only apply to --lab mode.');
            }

            const modes = [options.lab, options.rum, options.collect, options.collectHistory, options.sitemap, options.links].filter(Boolean);
            if (modes.length === 0) {
                console.error('Error: You must specify a mode: --lab, --rum, --collect, --collect-history, --sitemap, or --links.');
                process.exit(1);
            }
            if (modes.length > 1) {
                console.error('Error: Please specify only one mode: --lab, --rum, --collect, --collect-history, --sitemap, or --links.');
                process.exit(1);
            }

            if (!options.rum && !url) {
                console.error('Error: <url> argument is required for this mode.');
                process.exit(1);
            }

            if (options.lab) {
                console.log(`Running Lighthouse audit for: ${url}`);
                const outputPath = await runLab(url, {
                    profile: options.profile,
                    network: options.network,
                    device: options.device,
                });
                console.log(`Lab results saved to: ${outputPath}`);
            }

            if (options.rum) {
                let apiKey = options.apiKey;
                if (!apiKey && options.apiKeyPath) {
                    apiKey = fs.readFileSync(options.apiKeyPath, 'utf-8').trim();
                }
                if (!apiKey) {
                    console.error('Error: --api-key or --api-key-path is required for RUM mode.');
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

                // eslint-disable-next-line no-await-in-loop -- sequential to respect PSI API rate limits
                for (const targetUrl of urls) {
                    console.log(`Fetching PageSpeed Insights for: ${targetUrl}`);
                    const outputPath = await runRum(targetUrl, apiKey, categories); // eslint-disable-line no-await-in-loop
                    console.log(`RUM results saved to: ${outputPath}`);
                }
            }

            if (options.collect) {
                if (!options.apiKeyPath) {
                    console.error('Error: --api-key-path is required for collect mode (path to service account JSON).');
                    process.exit(1);
                }
                console.log(`Collecting CrUX data for: ${url}`);
                const outputPath = await runCollect(url, options.apiKeyPath);
                console.log(`Collect results saved to: ${outputPath}`);
            }
            if (options.collectHistory) {
                if (!options.apiKeyPath) {
                    console.error('Error: --api-key-path is required for collect-history mode (path to service account JSON).');
                    process.exit(1);
                }
                console.log(`Collecting historical CrUX data for: ${url}`);
                const outputPath = await runCollectHistory(url, options.apiKeyPath, options.since);
                console.log(`Collect-history results saved to: ${outputPath}`);
            }
            if (options.sitemap) {
                console.log(`Extracting sitemap URLs for: ${url}`);
                const outputPath = await runSitemap(url, options.depth || 3, options.sitemapUrl);
                console.log(`Sitemap results saved to: ${outputPath}`);
            }
            if (options.links) {
                console.log(`Extracting links from: ${url}`);
                const outputPath = await runLinks(url);
                console.log(`Links results saved to: ${outputPath}`);
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
        }
    });

program.parse(process.argv);
