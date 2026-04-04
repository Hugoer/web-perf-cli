# web-perf-audit

Node.js CLI for web performance auditing. CommonJS, executable via `npx web-perf`.

## CLI Subcommands

```bash
# Lab: Local Lighthouse (headless Chrome)
node bin/web-perf.js lab <url>
node bin/web-perf.js lab --profile=low <url>
node bin/web-perf.js lab --profile=native <url>
node bin/web-perf.js lab --profile=low,high <url>
node bin/web-perf.js lab --profile=all <url>
node bin/web-perf.js lab --network=3g --device=iphone-12 <url>
node bin/web-perf.js lab --profile=low --network=wifi <url>   # override parcial
node bin/web-perf.js list-profiles

# Lab: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js lab --urls=<url1>,<url2> --profile=low
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=all

# RUM: PageSpeed Insights API (single URL)
node bin/web-perf.js rum --api-key=<PSI_KEY> <url>
node bin/web-perf.js rum --api-key-path=<key-file.txt> <url>
node bin/web-perf.js rum --category=performance,seo --api-key-path=<key-file.txt> <url>

# RUM: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js rum --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js rum --urls-file=<urls.txt> --api-key=<PSI_KEY>
node bin/web-perf.js rum --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# Collect: CrUX API (origin-level, default scope)
node bin/web-perf.js collect --api-key=<PSI_KEY> <url>
node bin/web-perf.js collect --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js collect --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js collect --scope=page --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# Collect-History: Historical CrUX data via CrUX API (~6 months of weekly data points)
node bin/web-perf.js collect-history --api-key=<PSI_KEY> <url>
node bin/web-perf.js collect-history --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js collect-history --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>

# Sitemap: Extract URLs from sitemap.xml
node bin/web-perf.js sitemap [--depth=3] [--sitemap-url=<url>] <url>

# Links: Extract internal links from rendered DOM (SPA-compatible)
node bin/web-perf.js links <url>
```

## Structure

```
bin/web-perf.js    # CLI entrypoint (commander)
lib/lab.js         # Lighthouse via chrome-launcher
lib/rum.js         # PageSpeed Insights via node-fetch
lib/collect.js         # CrUX REST API (origin/page-level data via chromeuxreport.googleapis.com)
lib/links.js           # DOM link extractor via puppeteer-core + chrome-launcher
lib/sitemap.js         # Recursive sitemap parser
lib/profiles.js        # Lab simulation profiles, network/device presets
lib/utils.js       # Shared helpers (ensureResultsDir, buildFilename)
```

## Output

Each command writes to its own subdirectory under `results/`:

- `results/lab/` — lab (format: `lab-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/rum/` — rum (format: `rum-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/collect/` — collect (format: `collect-<hostname>-YYYY-MM-DD-HHMM-crux-api.json`)
- `results/collect-history/` — collect-history (format: `collect-history-<hostname>-YYYY-MM-DD-HHMM-crux-api.json`)
- `results/links/` — links (format: `links-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/sitemap/` — sitemap (format: `sitemap-<hostname>-YYYY-MM-DD-HHMM.json`)

## Environment Variables

| Variable | Command | Description |
|---|---|---|
| `WEB_PERF_PSI_API_KEY` | `rum`, `collect`, `collect-history` | API key for PageSpeed Insights / CrUX API (string) |
| `WEB_PERF_PSI_API_KEY_PATH` | `rum`, `collect`, `collect-history` | Path to file containing the API key |

CLI flags (`--api-key`, `--api-key-path`) take precedence over environment variables.

## Key Dependencies

- `lighthouse` v12 — default export via `.default` (ESM-style in CJS)
- `node-fetch` v2 — CJS-compatible version
- `puppeteer-core` — headless Chrome DOM access (connects to chrome-launcher instance)

## CrUX API

- Uses `chromeuxreport.googleapis.com` REST API
- `queryRecord` endpoint — 28-day rolling average (collect)
- `queryHistoryRecord` endpoint — ~6 months of weekly data points (collect-history)
- Supports both origin-level and page-level queries via `--scope` flag
- Pages need ~300+ monthly visits to have data

## Tests

```bash
npm test  # vitest
```
