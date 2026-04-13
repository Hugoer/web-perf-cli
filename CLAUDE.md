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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
