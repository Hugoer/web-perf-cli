# web-perf

Node.js CLI tool for web performance auditing. Analyze any website using local Lighthouse audits, real-user metrics from PageSpeed Insights, Chrome UX Report data via BigQuery, or sitemap URL extraction.

## Requirements

- **Node.js** >= 18
- **Google Chrome** installed locally (required for `lab`)
- **PageSpeed Insights API key** (required for `rum`) — pass inline with `--api-key`, via a file with `--api-key-path`, or set `WEB_PERF_PSI_API_KEY` (key) or `WEB_PERF_PSI_API_KEY_PATH` (file path) environment variable
- **Google Cloud service account JSON** with BigQuery User role (required for `collect` and `collect-history`) — pass via `--api-key-path`, or set `WEB_PERF_CRUX_KEY_PATH` (file path) or `WEB_PERF_CRUX_KEY` (JSON content) environment variable

## Setup

### PageSpeed Insights API key (for `rum`)

Create an API key in the [Google Cloud Console](https://console.cloud.google.com/) under **APIs & Services > Credentials**, with the **PageSpeed Insights API** enabled.

```bash
# Inline
node bin/web-perf.js rum --api-key=<YOUR_KEY> <url>

# From file (plain text, key only)
node bin/web-perf.js rum --api-key-path=<path-to-file> <url>

# Via environment variable (inline key)
export WEB_PERF_PSI_API_KEY=<YOUR_KEY>
node bin/web-perf.js rum <url>

# Via environment variable (file path)
export WEB_PERF_PSI_API_KEY_PATH=<path-to-key-file>
node bin/web-perf.js rum <url>
```

### Google Cloud service account JSON (for `collect` and `collect-history`)

Create a service account in the [Google Cloud Console](https://console.cloud.google.com/) under **IAM & Admin > Service Accounts** with the **BigQuery User** role (`roles/bigquery.user`), then export a JSON key.

```bash
# From file
node bin/web-perf.js collect --api-key-path=<service-account.json> <url>

# Via environment variable (file path)
export WEB_PERF_CRUX_KEY_PATH=<path-to-file.json>
node bin/web-perf.js collect <url>

# Via environment variable (JSON content)
export WEB_PERF_CRUX_KEY='{"type":"service_account",...}'
node bin/web-perf.js collect <url>
```

> **Note:** The BigQuery API is enabled by default in new projects. The service account only needs the **BigQuery User** role to query the public `chrome-ux-report` dataset.

## Installation

```bash
npm install
```

## Usage

```bash
node bin/web-perf.js <command> [options] <url>
```

Available commands: `lab`, `rum`, `collect`, `collect-history`, `links`, `sitemap`, `list-profiles`, `list-networks`, `list-devices`.

| Command | Source | Result | Options |
|---------|--------|--------|---------|
| `lab` | Local Lighthouse audit (headless Chrome) | JSON report with performance scores and Web Vitals | `--profile`, `--network`, `--device` |
| `rum` | PageSpeed Insights API (real-user data + Lighthouse) | JSON with field metrics and lab scores | `--api-key`, `--api-key-path`, `--urls`, `--urls-file`, `--category` |
| `collect` | Chrome UX Report via BigQuery (origin-level) | JSON with p75 Web Vitals by device and rank | `--api-key-path` |
| `collect-history` | Chrome UX Report via BigQuery (monthly snapshots) | JSON with historical p75 Web Vitals over time | `--api-key-path`, `--since` |
| `sitemap` | Domain's `sitemap.xml` (recursive) | JSON list of all URLs found | `--depth`, `--sitemap-url` |
| `links` | Rendered DOM via headless Chrome (SPA-compatible) | JSON list of internal links | — |
| `list-profiles` | — | Prints available simulation profiles | — |
| `list-networks` | — | Prints available network presets | — |
| `list-devices` | — | Prints available device presets | — |

## Commands

### `lab` — Local Lighthouse audit

Runs a full Lighthouse audit in headless Chrome and saves the JSON report. Supports simulation profiles to test under different device and network conditions.

```bash
# Default (Lighthouse defaults: Moto G Power on Slow 4G)
node bin/web-perf.js lab <url>

# Generic profiles
node bin/web-perf.js lab --profile=low <url>
node bin/web-perf.js lab --profile=high <url>

# Granular control
node bin/web-perf.js lab --network=3g --device=iphone-12 <url>

# Profile with partial override (low device + wifi network)
node bin/web-perf.js lab --profile=low --network=wifi <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Full URL to audit (e.g. `https://example.com`) |
| `--profile <preset>` | No | Simulation profile: `low`, `medium`, `high` |
| `--network <preset>` | No | Network throttling: `3g-slow`, `3g`, `4g`, `4g-fast`, `wifi`, `none` |
| `--device <preset>` | No | Device emulation: `moto-g-power`, `iphone-12`, `iphone-14`, `ipad`, `desktop`, `desktop-large` |

Run `list-profiles`, `list-networks`, or `list-devices` to see all available presets:

Chrome must be installed on the machine.

#### Profiles

| Profile | Device | Network | Description |
|---------|--------|---------|-------------|
| `low` | Moto G Power | Regular 3G | Budget phone on 3G |
| `medium` | Moto G Power | Slow 4G | Lighthouse default |
| `high` | Desktop 1350x940 | WiFi | Desktop on broadband |

When `--network` or `--device` are used together with `--profile`, the granular flags override the corresponding part of the profile. For example, `--profile=low --network=wifi` keeps the Moto G Power device but switches the network to WiFi.

```bash
node bin/web-perf.js list-profiles
node bin/web-perf.js list-networks
node bin/web-perf.js list-devices
```

**Output:** `results/lab/lab-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `rum` — PageSpeed Insights (real-user data)

Fetches real-user metrics and Lighthouse results from the PageSpeed Insights API.

```bash
# Single URL with inline API key
node bin/web-perf.js rum --api-key=<PSI_KEY> <url>

# Single URL with API key from file (plain text, key only)
node bin/web-perf.js rum --api-key-path=<path-to-key-file> <url>

# Multiple URLs (comma-separated) — <url> argument is ignored if present
node bin/web-perf.js rum --urls=<url1>,<url2>,<url3> --api-key=<PSI_KEY>

# Multiple URLs from file (one URL per line) — <url> argument is ignored if present
node bin/web-perf.js rum --urls-file=<urls.txt> --api-key=<PSI_KEY>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes\* | Full URL to analyze (e.g. `https://example.com`) |
| `--api-key <key>` | No\*\* | PageSpeed Insights API key passed inline |
| `--api-key-path <path>` | No\*\* | Path to a plain text file containing only the API key |
| `--urls <list>` | No | Comma-separated list of URLs. When provided, `<url>` argument is ignored |
| `--urls-file <path>` | No | Path to a file with one URL per line. When provided, `<url>` argument is ignored |
| `--category <list>` | No | Comma-separated Lighthouse categories to include. Values: `performance`, `accessibility`, `best-practices`, `seo`. Default: all four |

\* Not required when `--urls` or `--urls-file` is provided.
\*\* A PSI API key is required. Provide it via `--api-key`, `--api-key-path`, or the `WEB_PERF_PSI_API_KEY` / `WEB_PERF_PSI_API_KEY_PATH` environment variables. CLI flags take precedence.

```bash
# Only performance
node bin/web-perf.js rum --category=performance --api-key-path=<key-file> <url>

# Performance and SEO only
node bin/web-perf.js rum --category=performance,seo --api-key-path=<key-file> <url>
```

#### Credential resolution order

1. `--api-key` flag (inline key)
2. `--api-key-path` flag (file path)
3. `WEB_PERF_PSI_API_KEY` env var (inline key)
4. `WEB_PERF_PSI_API_KEY_PATH` env var (file path)
5. Interactive prompt

**Output:** `results/rum/rum-<hostname>-YYYY-MM-DD-HHMM.json` (one file per URL)

---

### `collect` — CrUX via BigQuery

Queries the Chrome UX Report materialized dataset in BigQuery for origin-level performance data. Note: CrUX only provides **origin-level** (domain) data, not per-page URL metrics.

```bash
node bin/web-perf.js collect --api-key-path=<service-account.json> <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or origin to query (e.g. `https://example.com` or `example.com`) |
| `--api-key-path <path>` | No\* | Path to a Google Cloud service account JSON file with BigQuery User role |

\* BigQuery credentials are required. Provide them via `--api-key-path`, `WEB_PERF_CRUX_KEY_PATH` (file path), or `WEB_PERF_CRUX_KEY` (JSON content) environment variable. CLI flags take precedence.

#### Credential resolution order

1. `--api-key-path` flag (file path)
2. `WEB_PERF_CRUX_KEY_PATH` env var (file path)
3. `WEB_PERF_CRUX_KEY` env var (JSON content)
4. Interactive prompt

**Output:** `results/collect/collect-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `collect-history` — Historical CrUX data via BigQuery

Queries the Chrome UX Report materialized dataset for all monthly snapshots within a date range. By default, retrieves the last 12 months of data. CrUX data is available as monthly snapshots since 2017.

```bash
node bin/web-perf.js collect-history --api-key-path=<service-account.json> [--since=YYYY-MM-DD] <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or origin to query (e.g. `https://example.com` or `example.com`) |
| `--api-key-path <path>` | No\* | Path to a Google Cloud service account JSON file with BigQuery User role |
| `--since <date>` | No | Start date in `YYYY-MM-DD` format. Default: 12 months ago |

\* BigQuery credentials are required. Credential resolution is identical to `collect` (see above).

**Output:** `results/collect-history/collect-history-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `sitemap` — Sitemap URL extraction

Parses a domain's `sitemap.xml` (including sitemap indexes) and extracts all URLs.

```bash
node bin/web-perf.js sitemap [--depth=<n>] [--sitemap-url=<url>] <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or URL to extract URLs from (e.g. `example.com` or `https://example.com`) |
| `--depth <n>` | No | Max recursion depth for sitemap indexes. Default: `3` |
| `--sitemap-url <url>` | No | Custom sitemap URL. Default: `<url>/sitemap.xml` |

**Output:** `results/sitemap/sitemap-<hostname>-YYYY-MM-DD-HHMM.json`

## Environment variables

| Variable | Command | Description |
|---|---|---|
| `WEB_PERF_PSI_API_KEY` | `rum` | PageSpeed Insights API key |
| `WEB_PERF_PSI_API_KEY_PATH` | `rum` | Path to file containing the PSI API key |
| `WEB_PERF_CRUX_KEY_PATH` | `collect`, `collect-history` | Path to BigQuery service account JSON file |
| `WEB_PERF_CRUX_KEY` | `collect`, `collect-history` | BigQuery service account JSON content (full JSON string) |

CLI flags (`--api-key`, `--api-key-path`) always take precedence over environment variables.

## Output structure

All results are saved as JSON files under the `results/` directory, organized by command:

```
results/
├── lab/
│   └── lab-example.com-2026-03-29-1430.json
├── rum/
│   └── rum-example.com-2026-03-29-1430.json
├── collect/
│   └── collect-www.example.com-2026-03-29-1430.json
├── collect-history/
│   └── collect-history-www.example.com-2026-03-29-1430.json
├── links/
│   └── links-www.example.com-2026-03-29-1430.json
└── sitemap/
    └── sitemap-www.example.com-2026-03-29-1430.json
```

## License

ISC
