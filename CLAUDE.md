# web-perf-audit

Node.js CLI for web performance auditing. CommonJS, executable via `npx web-perf`.

## CLI Modes

```bash
# Lab: Local Lighthouse (headless Chrome)
node bin/web-perf.js --lab <url>

# RUM: PageSpeed Insights API
node bin/web-perf.js --rum --api-key=<PSI_KEY> <url>

# Collect: CrUX via BigQuery (origin-level data only, NOT per-page URL)
node bin/web-perf.js --collect --api-key-path=<service-account.json> <url>

# Collect-History: Historical CrUX data via BigQuery (last 12 months by default)
node bin/web-perf.js --collect-history --api-key-path=<service-account.json> [--since=YYYY-MM-DD] <url>

# Sitemap: Extract URLs from sitemap.xml
node bin/web-perf.js --sitemap [--depth=3] [--sitemap-url=<url>] <domain>
```

## Structure

```
bin/web-perf.js    # CLI entrypoint (commander)
lib/lab.js         # Lighthouse via chrome-launcher
lib/rum.js         # PageSpeed Insights via node-fetch
lib/collect.js         # CrUX BigQuery (chrome-ux-report.materialized.device_summary)
lib/collect-history.js # CrUX BigQuery historical range query
lib/sitemap.js         # Recursive sitemap parser
lib/utils.js       # Shared helpers (ensureResultsDir, buildFilename)
```

## Output

Each mode writes to its own subdirectory under `results/`:

- `results/lab/` — lab (format: `lab-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/rum/` — rum (format: `rum-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/collect/` — collect (format: `collect-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/collect-history/` — collect-history (format: `collect-history-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/sitemap/` — sitemap (format: `sitemap-<hostname>-YYYY-MM-DD-HHMM.json`)

## Key Dependencies

- `lighthouse` v12 — default export via `.default` (ESM-style in CJS)
- `node-fetch` v2 — CJS-compatible version
- `@google-cloud/bigquery` — auth with service account JSON (requires BigQuery User role)

## BigQuery / CrUX

- Dataset: `chrome-ux-report.materialized.device_summary`
- Only contains **origin**-level (domain) data, NOT per-page URLs
- `yyyymmdd` is a DATE type — cast to STRING for single-date comparison, use CAST(@param AS DATE) for range queries
- Monthly snapshots available since 2017 — use date range queries for historical data
- CLS uses `small_cls/medium_cls/large_cls` (not fast/avg/slow like other metrics)
- Connection: `_4GDensity`, `_3GDensity`, `_2GDensity`, `slow2GDensity`, `offlineDensity`

## Tests

```bash
npm test  # vitest
```
