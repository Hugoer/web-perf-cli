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

# Lab: Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js lab --urls=<url1>,<url2> --profile=low
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=all

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

# Clean: Post-process existing raw output into AI-friendly .clean.json files
node bin/web-perf.js clean results/lab/lab-example.com.json   # single file
node bin/web-perf.js clean results/lab/                       # directory
node bin/web-perf.js clean 'results/**/*.json'                # glob
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
- `results/lab/clean/` — AI-friendly lab output when `--clean` is used (format: `lab-<hostname>-YYYY-MM-DD-HHMM.clean.json`)
- `results/psi/` — psi (format: `psi-<hostname>-YYYY-MM-DD-HHMM-<strategy>.json`, one file per strategy)
- `results/psi/clean/` — AI-friendly psi output when `--clean` is used (format: `psi-<hostname>-YYYY-MM-DD-HHMM-<strategy>.clean.json`)
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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk tsc
rtk lint
rtk prettier --check
```

### Test (90-99% savings)
```bash
rtk vitest run
rtk playwright test
rtk test <cmd>
```

### Git (59-80% savings)
```bash
rtk git status
rtk git log
rtk git diff
rtk git show
rtk git add
rtk git commit
rtk git push
rtk git pull
rtk git branch
rtk git fetch
rtk git stash
rtk git worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>
rtk gh pr checks
rtk gh run list
rtk gh issue list
rtk gh api
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk npm run <script>
rtk npx <cmd>
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>
rtk read <file>
rtk grep <pattern>
rtk find <pattern>
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>
rtk log <file>
rtk json <file>
rtk deps
rtk env
rtk summary <cmd>
rtk diff
```

### Network (65-70% savings)
```bash
rtk curl <url>
rtk wget <url>
```

### Meta Commands
```bash
rtk gain
rtk gain --history
rtk discover
rtk proxy <cmd>
rtk init
rtk init --global
```
<!-- /rtk-instructions -->