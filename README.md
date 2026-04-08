# web-perf

Node.js CLI tool for web performance auditing. Analyze any website using local Lighthouse audits, real-user metrics from PageSpeed Insights, Chrome UX Report data via CrUX API, or sitemap URL extraction.

## Requirements

- **Node.js** >= 18
- **Google Chrome** installed locally (required for `lab`)
- **Google Cloud API key** with PageSpeed Insights API and/or CrUX API enabled (required for `psi`, `crux`, `crux-history`) — pass inline with `--api-key`, via a file with `--api-key-path`, or set `WEB_PERF_PSI_API_KEY` (key) or `WEB_PERF_PSI_API_KEY_PATH` (file path) environment variable

## Setup

### Google Cloud API key (for `psi`, `crux`, `crux-history`)

Create an API key in the [Google Cloud Console](https://console.cloud.google.com/) under **APIs & Services > Credentials**, with the following APIs enabled:

- **PageSpeed Insights API** — required for `psi`
- **Chrome UX Report API** — required for `crux` and `crux-history`

> **Note:** After enabling the Chrome UX Report API, it may take a few minutes for the API key to become effective.

```bash
# Inline
node bin/web-perf.js psi --api-key=<YOUR_KEY> <url>
node bin/web-perf.js crux --api-key=<YOUR_KEY> <url>

# From file (plain text, key only)
node bin/web-perf.js psi --api-key-path=<path-to-file> <url>

# Via environment variable (inline key)
export WEB_PERF_PSI_API_KEY=<YOUR_KEY>
node bin/web-perf.js psi <url>

# Via environment variable (file path)
export WEB_PERF_PSI_API_KEY_PATH=<path-to-key-file>
node bin/web-perf.js crux <url>
```

## Installation

```bash
npm install
```

## Usage

```bash
node bin/web-perf.js <command> [options] <url>
```

Available commands: `lab`, `psi`, `crux`, `crux-history`, `links`, `sitemap`, `list-profiles`, `list-networks`, `list-devices`.

| Command | Source | Result | Options |
|---------|--------|--------|---------|
| `lab` | Local Lighthouse audit (headless Chrome) | JSON report with performance scores and Web Vitals | `--profile`, `--network`, `--device`, `--urls`, `--urls-file`, `--skip-audits`, `--blocked-url-patterns` |
| `psi` | PageSpeed Insights API (real-user data + Lighthouse) | JSON with field metrics and lab scores | `--api-key`, `--api-key-path`, `--urls`, `--urls-file`, `--category`, `--concurrency`, `--delay` |
| `crux` | CrUX API (origin or page, 28-day rolling average) | JSON with p75 Web Vitals and metric distributions | `--scope`, `--api-key`, `--api-key-path`, `--urls`, `--urls-file`, `--concurrency`, `--delay` |
| `crux-history` | CrUX History API (~6 months of weekly data points) | JSON with historical Web Vitals over time | `--scope`, `--api-key`, `--api-key-path`, `--urls`, `--urls-file`, `--concurrency`, `--delay` |
| `sitemap` | Domain's `sitemap.xml` (recursive, auto-detects sitemap URLs) | JSON list of all URLs found | `--depth`, `--delay`, `--output-ai` |
| `links` | Rendered DOM via headless Chrome (SPA-compatible) | JSON list of internal links | `--output-ai` |
| `list-profiles` | — | Prints available simulation profiles | — |
| `list-networks` | — | Prints available network presets | — |
| `list-devices` | — | Prints available device presets | — |

## Commands

### `lab` — Local Lighthouse audit

Runs a full Lighthouse audit in headless Chrome and saves the JSON report. Supports simulation profiles to test under different device and network conditions.

```bash
# Default (Lighthouse defaults: Moto G Power on Slow 4G)
node bin/web-perf.js lab <url>

# Single profile
node bin/web-perf.js lab --profile=low <url>
node bin/web-perf.js lab --profile=high <url>

# Multiple profiles (comma-separated)
node bin/web-perf.js lab --profile=low,high <url>

# All profiles (low, medium, high)
node bin/web-perf.js lab --profile=all <url>

# Granular control
node bin/web-perf.js lab --network=3g --device=iphone-12 <url>

# Profile with partial override (low device + wifi network)
node bin/web-perf.js lab --profile=low --network=wifi <url>

# Skip specific audits
node bin/web-perf.js lab --skip-audits=full-page-screenshot,screenshot-thumbnails <url>

# Block URL patterns (prevent asset downloads during audit, e.g. analytics, ads)
node bin/web-perf.js lab --blocked-url-patterns='*.google-analytics.com,*.facebook.net' <url>
node bin/web-perf.js lab --profile=low --blocked-url-patterns='*.ads.example.com' <url>

# Multiple URLs (<url> argument is ignored when --urls or --urls-file is provided)
node bin/web-perf.js lab --urls=<url1>,<url2> --profile=low
node bin/web-perf.js lab --urls-file=<urls.txt> --profile=all
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes* | Full URL to audit (e.g. `https://example.com`). Ignored when `--urls` or `--urls-file` is provided |
| `--profile <preset>` | No | Simulation profile(s): `low`, `medium`, `high`, `native`, `all` (comma-separated) |
| `--network <preset>` | No | Network throttling: `3g-slow`, `3g`, `4g`, `4g-fast`, `wifi`, `none` |
| `--device <preset>` | No | Device emulation: `moto-g-power`, `iphone-12`, `iphone-14`, `ipad`, `desktop`, `desktop-large` |
| `--urls <urls>` | No | Comma-separated list of URLs to audit |
| `--urls-file <path>` | No | Path to a file with one URL per line |
| `--skip-audits <audits>` | No | Comma-separated Lighthouse audits to skip. Default: `full-page-screenshot,screenshot-thumbnails,final-screenshot,valid-source-maps` |
| `--blocked-url-patterns <patterns>` | No | Comma-separated URL patterns to block during the audit (e.g. `*.google-analytics.com,*.facebook.net`). Uses Chrome DevTools Protocol to prevent matching assets from being downloaded |

Run `list-profiles`, `list-networks`, or `list-devices` to see all available presets:

Chrome must be installed on the machine.

#### Profiles

| Profile | Device | Network | Description |
|---------|--------|---------|-------------|
| `low` | Moto G Power | Regular 3G | Budget phone on 3G |
| `medium` | Moto G Power | Slow 4G | Lighthouse default |
| `high` | Desktop 1350x940 | WiFi | Desktop on broadband |
| `native` | No emulation | No throttling | Actual device (no emulation, no throttling) |

When `--network` or `--device` are used together with `--profile`, the granular flags override the corresponding part of the profile. For example, `--profile=low --network=wifi` keeps the Moto G Power device but switches the network to WiFi.

```bash
node bin/web-perf.js list-profiles
node bin/web-perf.js list-networks
node bin/web-perf.js list-devices
```

**Output:** `results/lab/lab-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `psi` — PageSpeed Insights (real-user data)

Fetches real-user metrics and Lighthouse results from the PageSpeed Insights API.

```bash
# Single URL with inline API key
node bin/web-perf.js psi --api-key=<PSI_KEY> <url>

# Single URL with API key from file (plain text, key only)
node bin/web-perf.js psi --api-key-path=<path-to-key-file> <url>

# Multiple URLs (comma-separated) — <url> argument is ignored if present
node bin/web-perf.js psi --urls=<url1>,<url2>,<url3> --api-key=<PSI_KEY>

# Multiple URLs from file (one URL per line) — <url> argument is ignored if present
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY>

# Parallel processing (10 concurrent requests, 100ms delay between each)
node bin/web-perf.js psi --urls-file=<urls.txt> --api-key=<PSI_KEY> --concurrency=10 --delay=100
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes\* | Full URL to analyze (e.g. `https://example.com`) |
| `--api-key <key>` | No\*\* | PageSpeed Insights API key passed inline |
| `--api-key-path <path>` | No\*\* | Path to a plain text file containing only the API key |
| `--urls <list>` | No | Comma-separated list of URLs. When provided, `<url>` argument is ignored |
| `--urls-file <path>` | No | Path to a file with one URL per line. When provided, `<url>` argument is ignored |
| `--category <list>` | No | Comma-separated Lighthouse categories to include. Values: `performance`, `accessibility`, `best-practices`, `seo`. Default: all four |
| `--concurrency <n>` | No | Max parallel API requests when processing multiple URLs. Default: `5` |
| `--delay <ms>` | No | Delay in ms between requests per worker. Default: `0` (no delay) |

Built-in quota protection: PSI request starts are capped at 4 requests/second globally during batch runs, regardless of `--concurrency`.

\* Not required when `--urls` or `--urls-file` is provided.
\*\* A PSI API key is required. Provide it via `--api-key`, `--api-key-path`, or the `WEB_PERF_PSI_API_KEY` / `WEB_PERF_PSI_API_KEY_PATH` environment variables. CLI flags take precedence.

```bash
# Only performance
node bin/web-perf.js psi --category=performance --api-key-path=<key-file> <url>

# Performance and SEO only
node bin/web-perf.js psi --category=performance,seo --api-key-path=<key-file> <url>
```

#### Credential resolution order

1. `--api-key` flag (inline key)
2. `--api-key-path` flag (file path)
3. `WEB_PERF_PSI_API_KEY` env var (inline key)
4. `WEB_PERF_PSI_API_KEY_PATH` env var (file path)
5. Interactive prompt

**Output:** `results/psi/psi-<hostname>-YYYY-MM-DD-HHMM.json` (one file per URL)

---

### `crux` — CrUX data (28-day rolling average)

Queries Chrome UX Report data via the CrUX REST API. Returns a 28-day rolling average of Web Vitals metrics. Supports both origin-level and page-level queries via `--scope`. Pages need ~300+ monthly visits to have data.

```bash
# Origin-level (default)
node bin/web-perf.js crux --api-key=<KEY> <url>

# Page-level
node bin/web-perf.js crux --scope=page --api-key=<KEY> <url>

# Multiple URLs (page scope)
node bin/web-perf.js crux --urls=<url1>,<url2> --api-key=<KEY>
node bin/web-perf.js crux --urls-file=<urls.txt> --api-key=<KEY> --concurrency=10 --delay=100
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes\* | URL or origin to query |
| `--scope <scope>` | No | Query scope: `origin` or `page`. Default is `origin` for single URL input, and `page` when using `--urls` or `--urls-file` |
| `--api-key <key>` | No\*\* | CrUX API key |
| `--api-key-path <path>` | No\*\* | Path to plain text file containing the API key |
| `--urls <urls>` | No | Comma-separated URLs (page scope) |
| `--urls-file <path>` | No | Path to file with one URL per line (page scope) |
| `--concurrency <n>` | No | Max parallel requests. Default: `5` |
| `--delay <ms>` | No | Delay between requests in ms. Default: `0` |

Built-in quota protection: CrUX request starts are capped at 2.5 requests/second globally during batch runs, regardless of `--concurrency`.

\* Not required when `--urls` or `--urls-file` is provided.
\*\* A CrUX API key is required. Provide via `--api-key`, `--api-key-path`, or the `WEB_PERF_PSI_API_KEY` / `WEB_PERF_PSI_API_KEY_PATH` environment variables.

**Output:** `results/crux/crux-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `crux-history` — Historical CrUX data

Queries the CrUX History API for ~6 months of weekly data points. Each data point represents a 28-day rolling average. Supports both origin-level and page-level queries.

```bash
# Origin-level (default)
node bin/web-perf.js crux-history --api-key=<KEY> <url>

# Page-level
node bin/web-perf.js crux-history --scope=page --api-key=<KEY> <url>

# Multiple URLs (page scope)
node bin/web-perf.js crux-history --urls=<url1>,<url2> --api-key=<KEY>
node bin/web-perf.js crux-history --urls-file=<urls.txt> --api-key=<KEY> --concurrency=10 --delay=100
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes\* | URL or origin to query (e.g. `https://example.com`) |
| `--scope <scope>` | No | Query scope: `origin` or `page`. Default is `origin` for single URL input, and `page` when using `--urls` or `--urls-file` |
| `--api-key <key>` | No\*\* | CrUX API key |
| `--api-key-path <path>` | No\*\* | Path to plain text file containing the API key |
| `--urls <urls>` | No | Comma-separated URLs (page scope) |
| `--urls-file <path>` | No | Path to file with one URL per line (page scope) |
| `--concurrency <n>` | No | Max parallel requests. Default: `5` |
| `--delay <ms>` | No | Delay between requests in ms. Default: `0` |

Built-in quota protection: CrUX History request starts are capped at 2.5 requests/second globally during batch runs, regardless of `--concurrency`.

\* Not required when `--urls` or `--urls-file` is provided.
\*\* A CrUX API key is required. Credential resolution is identical to `crux` (see above).

**Output:** `results/crux-history/crux-history-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `sitemap` — Sitemap URL extraction

Parses a domain's `sitemap.xml` (including sitemap indexes) and extracts all URLs. Auto-detects if the URL points to a sitemap (`.xml` extension) or uses `<url>/sitemap.xml` by default.

```bash
node bin/web-perf.js sitemap <url>
node bin/web-perf.js sitemap --depth=3 <url>
node bin/web-perf.js sitemap https://example.com/custom-sitemap.xml
node bin/web-perf.js sitemap --output-ai <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or sitemap URL (e.g. `example.com` or `example.com/sitemap-pages.xml`) |
| `--depth <n>` | No | Max recursion depth for sitemap indexes. Default: `3` |
| `--delay <ms>` | No | Delay between requests in ms (randomized ±50ms). Default: `0` |
| `--output-ai` | No | Generate AI-friendly `.txt` output (one URL per line, normalized) |

**Output:** `results/sitemap/sitemap-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `links` — Internal link extraction

Extracts internal links from the rendered DOM using headless Chrome. SPA-compatible (waits for JavaScript rendering).

```bash
node bin/web-perf.js links <url>
node bin/web-perf.js links --output-ai <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | URL to extract links from |
| `--output-ai` | No | Generate AI-friendly `.txt` output (one URL per line, normalized) |

**Output:** `results/links/links-<hostname>-YYYY-MM-DD-HHMM.json`

## Environment variables

| Variable | Command | Description |
|---|---|---|
| `WEB_PERF_PSI_API_KEY` | `psi`, `crux`, `crux-history` | API key for PageSpeed Insights / CrUX API |
| `WEB_PERF_PSI_API_KEY_PATH` | `psi`, `crux`, `crux-history` | Path to file containing the API key |

CLI flags (`--api-key`, `--api-key-path`) always take precedence over environment variables.

## Output structure

All results are saved as JSON files under the `results/` directory, organized by command:

```
results/
├── lab/
│   └── lab-example.com-2026-03-29-1430.json
├── psi/
│   └── psi-example.com-2026-03-29-1430.json
├── crux/
│   └── crux-www.example.com-2026-03-29-1430.json
├── crux-history/
│   └── crux-history-www.example.com-2026-03-29-1430.json
├── links/
│   └── links-www.example.com-2026-03-29-1430.json
└── sitemap/
    └── sitemap-www.example.com-2026-03-29-1430.json
```

## License

ISC
