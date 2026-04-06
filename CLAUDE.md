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

# Lab: Block URL patterns (prevent asset downloads during audit)
node bin/web-perf.js lab --blocked-url-patterns='*.google-analytics.com,*.facebook.net' <url>
node bin/web-perf.js lab --profile=low --blocked-url-patterns='*.ads.example.com' <url>

# Lab: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js lab --urls=<url1>,<url2> --profile=low
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=all

# PSI: PageSpeed Insights API (single URL)
node bin/web-perf.js psi --api-key=<PSI_KEY> <url>
node bin/web-perf.js psi --api-key-path=<key-file.txt> <url>
node bin/web-perf.js psi --category=performance,seo --api-key-path=<key-file.txt> <url>

# PSI: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js psi --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY>
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# CrUX: CrUX API (origin-level, default scope)
node bin/web-perf.js crux --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js crux --scope=page --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# CrUX History: Historical CrUX data via CrUX API (~6 months of weekly data points)
node bin/web-perf.js crux-history --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux-history --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux-history --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>

# Sitemap: Extract URLs from sitemap.xml (auto-detects if URL points to a sitemap)
node bin/web-perf.js sitemap <url>
node bin/web-perf.js sitemap --depth=3 <url>
node bin/web-perf.js sitemap https://example.com/custom-sitemap.xml

# Links: Extract internal links from rendered DOM (SPA-compatible)
node bin/web-perf.js links <url>
```

## Structure

```
bin/web-perf.js    # CLI entrypoint (commander)
lib/lab.js             # Lighthouse via chrome-launcher
lib/psi.js             # PageSpeed Insights via node-fetch
lib/crux.js            # CrUX REST API (origin/page-level, 28-day rolling average)
lib/crux-history.js    # CrUX History REST API (~6 months of weekly data points)
lib/links.js           # DOM link extractor via puppeteer-core + chrome-launcher
lib/sitemap.js         # Recursive sitemap parser
lib/profiles.js        # Lab simulation profiles, network/device presets
lib/utils.js           # Shared helpers (ensureResultsDir, buildFilename, normalizeOrigin)
```

## Output

Each command writes to its own subdirectory under `results/`:

- `results/lab/` — lab (format: `lab-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/psi/` — psi (format: `psi-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/crux/` — crux (format: `crux-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/crux-history/` — crux-history (format: `crux-history-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/links/` — links (format: `links-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/sitemap/` — sitemap (format: `sitemap-<hostname>-YYYY-MM-DD-HHMM.json`)

## Environment Variables

| Variable | Command | Description |
|---|---|---|
| `WEB_PERF_PSI_API_KEY` | `psi`, `crux`, `crux-history` | API key for PageSpeed Insights / CrUX API (string) |
| `WEB_PERF_PSI_API_KEY_PATH` | `psi`, `crux`, `crux-history` | Path to file containing the API key |

CLI flags (`--api-key`, `--api-key-path`) take precedence over environment variables.

## Key Dependencies

- `lighthouse` v12 — default export via `.default` (ESM-style in CJS)
- `node-fetch` v2 — CJS-compatible version
- `puppeteer-core` — headless Chrome DOM access (connects to chrome-launcher instance)

## CrUX API

- Uses `chromeuxreport.googleapis.com` REST API
- `queryRecord` endpoint — 28-day rolling average (crux)
- `queryHistoryRecord` endpoint — ~6 months of weekly data points (crux-history)
- Supports both origin-level and page-level queries via `--scope` flag
- Pages need ~300+ monthly visits to have data

## Tests

```bash
npm test  # vitest
```
