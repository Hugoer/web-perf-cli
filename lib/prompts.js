const fs = require('fs');
const inquirer = require('inquirer');
const { PROFILES, NETWORK_PRESETS, DEVICE_PRESETS } = require('./profiles');

function assertTTY() {
    if (!process.stdin.isTTY) {
        throw new Error(
            'Missing required arguments. Cannot prompt interactively (not a TTY). Provide all arguments via flags.'
        );
    }
}

function validateUrl(input) {
    try {
        // eslint-disable-next-line no-new
        new URL(input);
        return true;
    } catch {
        return 'Please enter a valid URL (e.g. https://example.com)';
    }
}

async function promptForSubcommand() {
    assertTTY();
    const { command } = await inquirer.prompt([
        {
            type: 'list',
            name: 'command',
            message: 'What would you like to do?',
            choices: [
                { name: 'lab                — Run a local Lighthouse audit', value: 'lab' },
                { name: 'rum                — Fetch PageSpeed Insights data', value: 'rum' },
                { name: 'collect            — Extract CrUX data from BigQuery', value: 'collect' },
                { name: 'collect-history    — Historical CrUX data from BigQuery', value: 'collect-history' },
                { name: 'sitemap            — Extract URLs from sitemap.xml', value: 'sitemap' },
                { name: 'links              — Extract internal links from rendered DOM', value: 'links' },
            ],
        },
    ]);
    return command;
}

async function promptLab(url, options) {
    assertTTY();
    const resolved = { url, profile: options.profile, network: options.network, device: options.device };

    if (!resolved.url) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'URL to audit:', validate: validateUrl },
        ]);
        resolved.url = answers.url;
    }

    if (!resolved.profile && !resolved.network && !resolved.device) {
        const profileChoices = Object.entries(PROFILES).map(([name, p]) => ({
            name: `${name.padEnd(10)} ${p.label}`,
            value: name,
        }));
        profileChoices.push({ name: '(none)     Custom network/device settings', value: '' });

        const { profile } = await inquirer.prompt([
            { type: 'list', name: 'profile', message: 'Simulation profile:', choices: profileChoices },
        ]);
        resolved.profile = profile || undefined;

        if (!profile) {
            const networkChoices = Object.entries(NETWORK_PRESETS).map(([name, n]) => ({
                name: `${name.padEnd(10)} ${n.label}`,
                value: name,
            }));
            networkChoices.unshift({ name: '(default)  Lighthouse default throttling', value: '' });

            const deviceChoices = Object.entries(DEVICE_PRESETS).map(([name, d]) => ({
                name: `${name.padEnd(16)} ${d.label}`,
                value: name,
            }));
            deviceChoices.unshift({ name: '(default)        Lighthouse default device', value: '' });

            const answers = await inquirer.prompt([
                { type: 'list', name: 'network', message: 'Network throttling:', choices: networkChoices },
                { type: 'list', name: 'device', message: 'Device emulation:', choices: deviceChoices },
            ]);
            resolved.network = answers.network || undefined;
            resolved.device = answers.device || undefined;
        }
    }

    return resolved;
}

async function promptRum(url, options) {
    assertTTY();
    const resolved = { apiKey: null, urls: [], categories: undefined };

    // Resolve API key: flag > file flag > env > prompt(key) > prompt(path)
    let apiKey = options.apiKey;
    if (!apiKey && options.apiKeyPath) {
        apiKey = fs.readFileSync(options.apiKeyPath, 'utf-8').trim();
    }
    if (!apiKey && process.env.WEB_PERF_PSI_API_KEY) {
        apiKey = process.env.WEB_PERF_PSI_API_KEY;
    }
    if (!apiKey) {
        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'PageSpeed Insights API key (Enter to provide file path instead):',
                mask: '*',
            },
        ]);
        apiKey = answers.apiKey;
    }
    if (!apiKey) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'apiKeyPath',
                message: 'Path to file containing the API key:',
                validate: (v) => {
                    if (!v.trim()) {
                        return 'API key or file path is required';
                    }
                    if (!fs.existsSync(v.trim())) {
                        return `File not found: ${v.trim()}`;
                    }
                    return true;
                },
            },
        ]);
        apiKey = fs.readFileSync(answers.apiKeyPath.trim(), 'utf-8').trim();
    }
    resolved.apiKey = apiKey;

    // Resolve URLs: arg > --urls > --urls-file > prompt
    const urls = [];
    const hasUrlList = options.urls || options.urlsFile;
    if (url && !hasUrlList) {
        urls.push(url);
    }
    if (options.urls) {
        urls.push(...options.urls.split(',').map((u) => u.trim()).filter(Boolean));
    }
    if (options.urlsFile) {
        const fileContent = fs.readFileSync(options.urlsFile, 'utf-8');
        urls.push(...fileContent.split('\n').map((u) => u.trim()).filter(Boolean));
    }
    if (urls.length === 0) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'urls',
                message: 'URLs to analyze (comma-separated):',
                validate: (v) => {
                    const parts = v.split(',').map((u) => u.trim()).filter(Boolean);
                    if (parts.length === 0) {
                        return 'At least one URL is required';
                    }
                    for (const u of parts) {
                        const result = validateUrl(u);
                        if (result !== true) {
                            return result;
                        }
                    }
                    return true;
                },
            },
        ]);
        urls.push(...answers.urls.split(',').map((u) => u.trim()).filter(Boolean));
    }
    resolved.urls = urls;

    // Resolve categories: flag > prompt
    if (options.category) {
        resolved.categories = options.category.split(',').map((c) => c.trim().toUpperCase().replace(/-/g, '_'));
    } else {
        const { categories } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'categories',
                message: 'Lighthouse categories (all selected by default):',
                choices: [
                    { name: 'Performance', value: 'PERFORMANCE', checked: true },
                    { name: 'Accessibility', value: 'ACCESSIBILITY', checked: true },
                    { name: 'Best Practices', value: 'BEST_PRACTICES', checked: true },
                    { name: 'SEO', value: 'SEO', checked: true },
                ],
            },
        ]);
        resolved.categories = categories.length > 0 ? categories : undefined;
    }

    return resolved;
}

async function promptCollect(url, options) {
    assertTTY();
    const resolved = { url, cruxAuth: null };

    if (!resolved.url) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'Domain or origin to query:', validate: validateUrl },
        ]);
        resolved.url = answers.url;
    }

    // Resolve CrUX auth: flag > env path > env json > prompt
    let cruxAuth = null;
    if (options.apiKeyPath) {
        cruxAuth = { keyFilename: options.apiKeyPath };
    } else if (process.env.WEB_PERF_CRUX_KEY_PATH) {
        cruxAuth = { keyFilename: process.env.WEB_PERF_CRUX_KEY_PATH };
    } else if (process.env.WEB_PERF_CRUX_KEY) {
        cruxAuth = { credentials: JSON.parse(process.env.WEB_PERF_CRUX_KEY) };
    }
    if (!cruxAuth) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'keyPath',
                message: 'Path to BigQuery service account JSON:',
                validate: (v) => {
                    if (!v.trim()) {
                        return 'Path is required';
                    }
                    if (!fs.existsSync(v.trim())) {
                        return `File not found: ${v.trim()}`;
                    }
                    return true;
                },
            },
        ]);
        cruxAuth = { keyFilename: answers.keyPath.trim() };
    }
    resolved.cruxAuth = cruxAuth;

    return resolved;
}

async function promptCollectHistory(url, options) {
    assertTTY();
    const collectResult = await promptCollect(url, options);
    const resolved = { ...collectResult, since: options.since };

    if (!resolved.since) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'since',
                message: 'Start date YYYY-MM-DD (Enter = 12 months ago):',
                validate: (v) => {
                    if (!v.trim()) {
                        return true;
                    }
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
                        return 'Use format YYYY-MM-DD';
                    }
                    if (isNaN(Date.parse(v.trim()))) {
                        return 'Invalid date';
                    }
                    return true;
                },
            },
        ]);
        resolved.since = answers.since.trim() || undefined;
    }

    return resolved;
}

async function promptSitemap(url, options) {
    assertTTY();
    const resolved = { url, depth: options.depth, sitemapUrl: options.sitemapUrl, delay: options.delay };

    if (!resolved.url) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'Domain or URL to extract sitemap from:', validate: validateUrl },
        ]);
        resolved.url = answers.url;
    }

    if (resolved.depth == null) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'depth',
                message: 'Max recursion depth (Enter = 3):',
                validate: (v) => {
                    if (!v.trim()) {
                        return true;
                    }
                    const n = parseInt(v, 10);
                    if (isNaN(n) || n < 1) {
                        return 'Enter a positive number';
                    }
                    return true;
                },
            },
        ]);
        resolved.depth = answers.depth.trim() ? parseInt(answers.depth, 10) : 3;
    }

    if (!resolved.sitemapUrl) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'sitemapUrl',
                message: 'Custom sitemap URL (Enter = auto-detect):',
            },
        ]);
        resolved.sitemapUrl = answers.sitemapUrl.trim() || undefined;
    }

    if (resolved.delay == null) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'delay',
                message: 'Delay between requests in ms (Enter = no delay):',
                validate: (v) => {
                    if (!v.trim()) {
                        return true;
                    }
                    const n = parseInt(v, 10);
                    if (isNaN(n)) {
                        return 'Enter a number in milliseconds';
                    }
                    return true;
                },
            },
        ]);
        resolved.delay = answers.delay.trim() ? parseInt(answers.delay, 10) : undefined;
    }

    return resolved;
}

async function promptLinks(url) {
    assertTTY();
    let resolved = url;

    if (!resolved) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'URL to extract links from:', validate: validateUrl },
        ]);
        resolved = answers.url;
    }

    return resolved;
}

module.exports = {
    promptForSubcommand,
    promptLab,
    promptRum,
    promptCollect,
    promptCollectHistory,
    promptSitemap,
    promptLinks,
};
