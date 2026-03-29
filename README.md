# web-perf

Node.js CLI tool for web performance auditing. Analyze any website using local Lighthouse audits, real-user metrics from PageSpeed Insights, Chrome UX Report data via BigQuery, or sitemap URL extraction.

## Requirements

- **Node.js** >= 18
- **Google Chrome** installed locally (required for `--lab` mode)
- **PageSpeed Insights API key** (required for `--rum` mode) — [Get one here](https://developers.google.com/speed/docs/insights/v5/get-started#key)
- **Google Cloud service account JSON** with BigQuery User role (required for `--collect` mode)

## Installation

```bash
npm install
```

## Usage

```bash
node bin/web-perf.js [options] <url>
```

You must specify exactly one mode per execution: `--lab`, `--rum`, `--collect`, or `--sitemap`.

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
node bin/web-perf.js --rum --api-key=<PSI_KEY> <url>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<url>` | Yes | Full URL to analyze (e.g. `https://example.com`) |
| `--api-key <key>` | Yes | PageSpeed Insights API key |

**Output:** `results/rum/rum-<hostname>-YYYY-MM-DD-HHMM.json`

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
└── sitemap/
    └── sitemap-www.example.com-2026-03-29-1430.json
```

## License

ISC
