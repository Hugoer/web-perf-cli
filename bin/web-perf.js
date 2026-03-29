#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const { runLab } = require('../lib/lab');
const { runRum } = require('../lib/rum');
const { runCollect } = require('../lib/collect');
const { runCollectHistory } = require('../lib/collect-history');
const { runSitemap } = require('../lib/sitemap');
const { runLinks } = require('../lib/links');

program
  .name('web-perf')
  .description('Analyze web performance via Lighthouse (lab), PageSpeed Insights (RUM), CrUX BigQuery (collect/collect-history), or sitemap extraction (sitemap)')
  .argument('<url>', 'URL or domain to analyze')
  .option('--lab', 'Run a local Lighthouse audit')
  .option('--rum', 'Fetch data from PageSpeed Insights API')
  .option('--collect', 'Extract CrUX data from BigQuery materialized tables')
  .option('--collect-history', 'Extract historical CrUX data from BigQuery')
  .option('--links', 'Extract internal links from the rendered DOM (supports SPAs)')
  .option('--sitemap', 'Extract all URLs from the domain sitemap.xml')
  .option('--depth <n>', 'Max depth for sitemap index recursion (default: 3)', parseInt)
  .option('--sitemap-url <url>', 'Custom sitemap URL (default: <domain>/sitemap.xml)')
  .option('--api-key <key>', 'PageSpeed Insights API key inline (for --rum)')
  .option('--api-key-path <path>', 'Path to a key file: plain text with API key (for --rum) or service account JSON (for --collect/--collect-history)')
  .option('--since <date>', 'Start date for --collect-history (YYYY-MM-DD, default: 12 months ago)')
  .option('--category <categories>', 'Comma-separated Lighthouse categories for --rum (default: performance,accessibility,best-practices,seo)')
  .action(async (url, options) => {
    try {
      const modes = [options.lab, options.rum, options.collect, options.collectHistory, options.sitemap, options.links].filter(Boolean);
      if (modes.length === 0) {
        console.error('Error: You must specify a mode: --lab, --rum, --collect, --collect-history, --sitemap, or --links.');
        process.exit(1);
      }
      if (modes.length > 1) {
        console.error('Error: Please specify only one mode: --lab, --rum, --collect, --collect-history, --sitemap, or --links.');
        process.exit(1);
      }

      if (options.lab) {
        console.log(`Running Lighthouse audit for: ${url}`);
        const outputPath = await runLab(url);
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
          ? options.category.split(',').map(c => c.trim().toUpperCase().replace(/-/g, '_'))
          : undefined;
        console.log(`Fetching PageSpeed Insights for: ${url}`);
        const outputPath = await runRum(url, apiKey, categories);
        console.log(`RUM results saved to: ${outputPath}`);
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
