# web-perf

Node.js CLI tool for web performance auditing. Analyze any website using local Lighthouse audits, real-user metrics from PageSpeed Insights, Chrome UX Report data via BigQuery, or sitemap URL extraction.

## Requirements

- **Node.js** >= 18
- **Google Chrome** installed locally (required for `--lab` mode)
- **PageSpeed Insights API key** (required for `--rum` mode) — pass inline with `--api-key` or via a file with `--api-key-path`
- **Google Cloud service account JSON** with BigQuery User role (required for `--collect` and `--collect-history` modes)

## Setup

### PageSpeed Insights API key (for `--rum` mode)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Library**
4. Search for **PageSpeed Insights API** and enable it
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API key**
7. Copy the generated key — you can either:
   - Pass it inline: `--api-key=<YOUR_KEY>`
   - Save it to a plain text file (just the key, nothing else) and reference it: `--api-key-path=<path-to-file>`

Optional: restrict the key to only the PageSpeed Insights API under **API restrictions** in the key settings.

### Google Cloud service account JSON (for `--collect` and `--collect-history` modes)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **IAM & Admin > Service Accounts**
4. Click **Create Service Account**
   - Name: e.g. `crux-reader`
   - Click **Create and Continue**
5. Grant the role **BigQuery User** (`roles/bigquery.user`) — this allows running queries against public datasets like CrUX
   - Click **Continue**, then **Done**
6. Click on the newly created service account
7. Go to the **Keys** tab
8. Click **Add Key > Create new key**
9. Select **JSON** and click **Create**
10. Save the downloaded `.json` file securely — use it with `--api-key-path=<path-to-file.json>`

> **Note:** You do not need to enable the BigQuery API manually — it is enabled by default in new projects. The service account only needs the **BigQuery User** role to query the public `chrome-ux-report` dataset.

## Installation

```bash
npm install
```

## Usage

```bash
node bin/web-perf.js [options] <url>
```

You must specify exactly one mode per execution: `--lab`, `--rum`, `--collect`, `--collect-history`, or `--sitemap`.

## Modes

### `--lab` — Local Lighthouse audit

Runs a full Lighthouse audit in headless Chrome and saves the JSON report.

```bash
node bin/web-perf.js --lab <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Full URL to audit (e.g. `https://example.com`) |

No additional options. Chrome must be installed on the machine.

**Output:** `results/lab/lab-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `--rum` — PageSpeed Insights (real-user data)

Fetches real-user metrics and Lighthouse results from the PageSpeed Insights API.

```bash
# Single URL with inline API key
node bin/web-perf.js --rum --api-key=<PSI_KEY> <url>

# Single URL with API key from file (plain text, key only)
node bin/web-perf.js --rum --api-key-path=<path-to-key-file> <url>

# Multiple URLs (comma-separated) — <url> argument is ignored if present
node bin/web-perf.js --rum --urls=<url1>,<url2>,<url3> --api-key=<PSI_KEY>

# Multiple URLs from file (one URL per line) — <url> argument is ignored if present
node bin/web-perf.js --rum --urls-file=<urls.txt> --api-key=<PSI_KEY>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes (unless `--urls` or `--urls-file` is provided) | Full URL to analyze (e.g. `https://example.com`) |
| `--api-key <key>` | One of the two | PageSpeed Insights API key passed inline |
| `--api-key-path <path>` | One of the two | Path to a plain text file containing only the API key |
| `--urls <list>` | No | Comma-separated list of URLs. When provided, `<url>` argument is ignored |
| `--urls-file <path>` | No | Path to a file with one URL per line. When provided, `<url>` argument is ignored |
| `--category <list>` | No | Comma-separated Lighthouse categories to include. Values: `performance`, `accessibility`, `best-practices`, `seo`. Default: all four |

```bash
# Only performance
node bin/web-perf.js --rum --category=performance --api-key-path=<key-file> <url>

# Performance and SEO only
node bin/web-perf.js --rum --category=performance,seo --api-key-path=<key-file> <url>
```

**Output:** `results/rum/rum-<hostname>-YYYY-MM-DD-HHMM.json` (one file per URL)

---

### `--collect` — CrUX via BigQuery

Queries the Chrome UX Report materialized dataset in BigQuery for origin-level performance data. Note: CrUX only provides **origin-level** (domain) data, not per-page URL metrics.

```bash
node bin/web-perf.js --collect --api-key-path=<service-account.json> <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or origin to query (e.g. `https://example.com` or `example.com`) |
| `--api-key-path <path>` | Yes | Path to a Google Cloud service account JSON file with BigQuery User role |

**Output:** `results/collect/collect-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `--collect-history` — Historical CrUX data via BigQuery

Queries the Chrome UX Report materialized dataset for all monthly snapshots within a date range. By default, retrieves the last 12 months of data. CrUX data is available as monthly snapshots since 2017.

```bash
node bin/web-perf.js --collect-history --api-key-path=<service-account.json> [--since=YYYY-MM-DD] <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Domain or origin to query (e.g. `https://example.com` or `example.com`) |
| `--api-key-path <path>` | Yes | Path to a Google Cloud service account JSON file with BigQuery User role |
| `--since <date>` | No | Start date in `YYYY-MM-DD` format. Default: 12 months ago |

**Output:** `results/collect-history/collect-history-<hostname>-YYYY-MM-DD-HHMM.json`

---

### `--sitemap` — Sitemap URL extraction

Parses a domain's `sitemap.xml` (including sitemap indexes) and extracts all URLs.

```bash
node bin/web-perf.js --sitemap [--depth=<n>] [--sitemap-url=<url>] <domain>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<domain>` | Yes | Domain to extract URLs from (e.g. `example.com` or `https://example.com`) |
| `--depth <n>` | No | Max recursion depth for sitemap indexes. Default: `3` |
| `--sitemap-url <url>` | No | Custom sitemap URL. Default: `<domain>/sitemap.xml` |

**Output:** `results/sitemap/sitemap-<hostname>-YYYY-MM-DD-HHMM.json`

## Output structure

All results are saved as JSON files under the `results/` directory, organized by mode:

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
└── sitemap/
    └── sitemap-www.example.com-2026-03-29-1430.json
```

## License

ISC
