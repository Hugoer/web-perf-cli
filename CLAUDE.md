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

# Lab: AI-friendly output (--clean writes a stripped copy for pasting into AI prompts)
node bin/web-perf.js lab --clean <url>
node bin/web-perf.js lab --profile=low --clean <url>

# Lab: Block URL patterns (prevent asset downloads during audit)
node bin/web-perf.js lab --blocked-url-patterns='*.google-analytics.com,*.facebook.net' <url>
node bin/web-perf.js lab --profile=low --blocked-url-patterns='*.ads.example.com' <url>

# Lab: Filter Lighthouse categories (maps to onlyCategories). Default: all (incl. agentic-browsing).
# Categories: performance, accessibility, best-practices, seo, agentic-browsing
node bin/web-perf.js lab --category=agentic-browsing <url>
node bin/web-perf.js lab --category=performance,seo <url>
node bin/web-perf.js lab --profile=low --category=agentic-browsing <url>

# Lab: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js lab --urls=<url1>,<url2> --profile=low
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=all

# Lab: Browser isolation. Every run launches its own Chrome by default, so no run inherits
# warm DNS caches or socket pools from the run before it (Lighthouse clears storage between
# runs, but not connections). --reuse-browser shares one Chrome across the whole plan:
# ~1s/run faster (measured: 18s vs 22s over 4 runs), but scores become dependent on
# position in the run order.
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=low --reuse-browser

# Lab: Repeat runs. Lantern bakes host CPU speed and observed server latency into the score,
# so a busy machine scores worse for reasons unrelated to the page. --runs=N audits each
# (URL x profile) pair N times and writes a .summary.json with the median, the spread, and
# the benchmarkIndex range. Warns when benchmarkIndex varies >1.5x (host not idle) or drops
# below 1000 (host too slow to compare). Mutually exclusive with --reuse-browser.
node bin/web-perf.js lab --runs=5 --profile=medium <url>
node bin/web-perf.js lab --runs=3 --profile=low,high --urls-file=<urls.txt>

# PSI: AI-friendly output
node bin/web-perf.js psi --clean --api-key=<PSI_KEY> <url>

# PSI: PageSpeed Insights API (single URL) — defaults to mobile + desktop (2 files per URL)
node bin/web-perf.js psi --api-key=<PSI_KEY> <url>
node bin/web-perf.js psi --api-key-path=<key-file.txt> <url>
node bin/web-perf.js psi --category=performance,seo --api-key-path=<key-file.txt> <url>

# PSI: Strategy selection (default: mobile,desktop — each URL produces 2 API requests + 2 files)
node bin/web-perf.js psi --strategy=mobile --api-key=<PSI_KEY> <url>
node bin/web-perf.js psi --strategy=desktop --api-key=<PSI_KEY> <url>
node bin/web-perf.js psi --strategy=mobile,desktop --api-key=<PSI_KEY> <url>

# PSI: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
# Total requests = urls × strategies — mind the 25,000/day, 240/min PSI quota.
node bin/web-perf.js psi --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY>
node bin/web-perf.js psi --urls-file=<urls.txt> --strategy=mobile --api-key=<PSI_KEY>
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# CrUX: CrUX API (origin-level, default scope) — defaults to phone + desktop (2 files per URL)
node bin/web-perf.js crux --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>
node bin/web-perf.js crux --scope=page --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100

# CrUX: Form factor selection (default: phone,desktop — each URL produces 2 API requests + 2 files)
node bin/web-perf.js crux --form-factor=phone --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --form-factor=desktop --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --form-factor=phone,desktop,tablet --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux --form-factor=phone --urls-file=<urls.txt> --api-key=<PSI_KEY>

# CrUX History: Historical CrUX data via CrUX API (~6 months of weekly data points) — defaults to phone + desktop
node bin/web-perf.js crux-history --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux-history --scope=page --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux-history --scope=page --urls=<url1>,<url2> --api-key=<PSI_KEY>

# CrUX History: Form factor selection
node bin/web-perf.js crux-history --form-factor=phone --api-key=<PSI_KEY> <url>
node bin/web-perf.js crux-history --form-factor=phone,desktop,tablet --scope=page --urls-file=<urls.txt> --api-key=<PSI_KEY>

# Sitemap: Extract URLs from sitemap.xml (auto-detects if URL points to a sitemap)
node bin/web-perf.js sitemap <url>
node bin/web-perf.js sitemap --depth=3 <url>
node bin/web-perf.js sitemap https://example.com/custom-sitemap.xml

# Links: Extract internal links from rendered DOM (SPA-compatible)
node bin/web-perf.js links <url>

# Clean: Post-process existing raw output into AI-friendly .clean.json files
node bin/web-perf.js clean results/lab/lab-example.com.json   # single file
node bin/web-perf.js clean results/lab/                       # directory
node bin/web-perf.js clean 'results/**/*.json'                # glob
```

## Structure

```
bin/web-perf.js    # CLI entrypoint (commander)
lib/lab.js             # Lighthouse via chrome-launcher
lib/psi.js             # PageSpeed Insights via global fetch
lib/crux.js            # CrUX REST API (origin/page-level, 28-day rolling average)
lib/crux-history.js    # CrUX History REST API (~6 months of weekly data points)
lib/links.js           # DOM link extractor via puppeteer-core + chrome-launcher
lib/sitemap.js         # Recursive sitemap parser
lib/profiles.js        # Lab simulation profiles, network/device presets
lib/variance.js        # Run-to-run variance: median selection, benchmarkIndex stability
lib/utils.js           # Shared helpers (ensureResultsDir, buildFilename, normalizeOrigin)
```

## Output

Each command writes to its own subdirectory under `results/`:

- `results/lab/` — lab (format: `lab-<hostname>-YYYY-MM-DD-HHMMSS-<profile>.json`)
- `results/lab/` — with `--runs=N`, each run gets a `-runNN` suffix plus one
  `lab-<hostname>-YYYY-MM-DD-HHMMSS-<profile>.summary.json` per (URL x profile) pair.
  The summary is named after the group's FIRST run, so it sorts alongside `-run01`.
- `results/lab/clean/` — AI-friendly lab output when `--clean` is used (format: `lab-<hostname>-YYYY-MM-DD-HHMM.clean.json`)
- `results/psi/` — psi (format: `psi-<hostname>-YYYY-MM-DD-HHMM-<strategy>.json`, one file per strategy)
- `results/psi/clean/` — AI-friendly psi output when `--clean` is used (format: `psi-<hostname>-YYYY-MM-DD-HHMM-<strategy>.clean.json`)
- `results/crux/` — crux (format: `crux-<hostname>-YYYY-MM-DD-HHMM-<form-factor>.json`, one file per form factor)
- `results/crux-history/` — crux-history (format: `crux-history-<hostname>-YYYY-MM-DD-HHMM-<form-factor>.json`, one file per form factor)
- `results/links/` — links (format: `links-<hostname>-YYYY-MM-DD-HHMM.json`)
- `results/sitemap/` — sitemap (format: `sitemap-<hostname>-YYYY-MM-DD-HHMM.json`)

## Environment Variables

| Variable | Command | Description |
|---|---|---|
| `WEB_PERF_PSI_API_KEY` | `psi`, `crux`, `crux-history` | API key for PageSpeed Insights / CrUX API (string) |
| `WEB_PERF_PSI_API_KEY_PATH` | `psi`, `crux`, `crux-history` | Path to file containing the API key |

CLI flags (`--api-key`, `--api-key-path`) take precedence over environment variables.

## Key Dependencies

- `lighthouse` v13 — ESM-only, so it is loaded via dynamic `import()` inside `runLabAudit`
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

## Development Checklist

Run these in order at the end of every task, without exception:

```bash
npm run lint          # must pass before running tests
npm test              # all tests must pass
npm run generate-types  # regenerate types after any function signature change
```

### Rules

**JSDoc** — Any change to a function's parameters or return value requires updating its `@param` / `@returns` JSDoc. The generated `.d.ts` is the source of truth for consumers; stale types are bugs.

**New lib modules** — Every new `lib/*.js` file must be added to:
1. `tsconfig.types.json` → `include` array (so `generate-types` picks it up)
2. `package.json` → `exports` object (so the module is importable as `web-perf/<name>`)

**New CLI commands** — When a new subcommand is added to `bin/web-perf.js`, update `promptForSubcommand()` in `lib/prompts.js` and the `actions` map in `wizardMode()` so it is reachable from interactive mode.

**Testable logic belongs in `lib/`** — `bin/web-perf.js` holds CLI wiring only: argument parsing, prompt orchestration, and logging. Anything with branching logic worth a regression test goes in a `lib/` module and is exported, because helpers defined inside `bin/` are unexported and unreachable from the test suite.
