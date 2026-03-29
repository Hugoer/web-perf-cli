#!/usr/bin/env node

const { program } = require('commander');
const { runLab } = require('../lib/lab');
const { runRum } = require('../lib/rum');
const { runCollect } = require('../lib/collect');
const { runSitemap } = require('../lib/sitemap');

program
  .name('web-perf')
  .description('Analyze web performance via Lighthouse (lab), PageSpeed Insights (RUM), CrUX BigQuery (collect), or sitemap extraction (sitemap)')
  .argument('<url>', 'URL or domain to analyze')
  .option('--lab', 'Run a local Lighthouse audit')
  .option('--rum', 'Fetch data from PageSpeed Insights API')
  .option('--collect', 'Extract CrUX data from BigQuery materialized tables')
  .option('--sitemap', 'Extract all URLs from the domain sitemap.xml')
  .option('--depth <n>', 'Max depth for sitemap index recursion (default: 3)', parseInt)
  .option('--sitemap-url <url>', 'Custom sitemap URL (default: <domain>/sitemap.xml)')
  .option('--api-key <key>', 'PageSpeed Insights API key (for --rum)')
  .option('--api-key-path <path>', 'Path to service account JSON file (for --collect)')
  .action(async (url, options) => {
    try {
      const modes = [options.lab, options.rum, options.collect, options.sitemap].filter(Boolean);
      if (modes.length === 0) {
        console.error('Error: You must specify a mode: --lab, --rum, --collect, or --sitemap.');
        process.exit(1);
      }
      if (modes.length > 1) {
        console.error('Error: Please specify only one mode: --lab, --rum, --collect, or --sitemap.');
        process.exit(1);
      }

      if (options.lab) {
        console.log(`Running Lighthouse audit for: ${url}`);
        const outputPath = await runLab(url);
        console.log(`Lab results saved to: ${outputPath}`);
      }

      if (options.rum) {
        if (!options.apiKey) {
          console.error('Error: --api-key is required for RUM mode.');
          process.exit(1);
        }
        console.log(`Fetching PageSpeed Insights for: ${url}`);
        const outputPath = await runRum(url, options.apiKey);
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
      if (options.sitemap) {
        console.log(`Extracting sitemap URLs for: ${url}`);
        const outputPath = await runSitemap(url, options.depth || 3, options.sitemapUrl);
        console.log(`Sitemap results saved to: ${outputPath}`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
