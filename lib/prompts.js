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

function validatePositiveInt(input) {
    if (!input.trim()) {
        return true;
    }
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1) {
        return 'Enter a positive number';
    }
    return true;
}

function validateNonNegativeInt(input) {
    if (!input.trim()) {
        return true;
    }
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 0) {
        return 'Enter a number in milliseconds';
    }
    return true;
}

function validateFilePath(input, requiredMsg = 'Path is required') {
    if (!input.trim()) {
        return requiredMsg;
    }
    if (!fs.existsSync(input.trim())) {
        return `File not found: ${input.trim()}`;
    }
    return true;
}

function resolveRumApiKey(options) {
    if (options.apiKey) {
        return options.apiKey;
    }
    if (options.apiKeyPath) {
        return fs.readFileSync(options.apiKeyPath, 'utf-8').trim();
    }
    if (process.env.WEB_PERF_PSI_API_KEY) {
        return process.env.WEB_PERF_PSI_API_KEY;
    }
    if (process.env.WEB_PERF_PSI_API_KEY_PATH) {
        return fs.readFileSync(process.env.WEB_PERF_PSI_API_KEY_PATH, 'utf-8').trim();
    }
    return null;
}

function resolveCruxAuth(options) {
    if (options.apiKeyPath) {
        return { keyFilename: options.apiKeyPath };
    }
    if (process.env.WEB_PERF_CRUX_KEY_PATH) {
        return { keyFilename: process.env.WEB_PERF_CRUX_KEY_PATH };
    }
    if (process.env.WEB_PERF_CRUX_KEY) {
        return { credentials: JSON.parse(process.env.WEB_PERF_CRUX_KEY) };
    }
    return null;
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

function parseProfileFlag(profileStr) {
    if (!profileStr) {
        return [];
    }
    if (profileStr === 'all') {
        return Object.keys(PROFILES);
    }
    const names = profileStr.split(',').map((p) => p.trim()).filter(Boolean);
    const valid = Object.keys(PROFILES);
    for (const name of names) {
        if (!valid.includes(name)) {
            throw new Error(`Unknown profile: "${name}". Valid profiles: ${valid.join(', ')}, all`);
        }
    }
    return names;
}

async function promptLab(url, options) {
    const resolved = { urls: [], runs: [] };

    // Resolve URLs: --urls > --urls-file > positional arg > interactive prompt
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
        assertTTY();
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'urls',
                message: 'URLs to audit (comma-separated):',
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

    // Flag path: profile, network, or device provided via CLI flags
    if (options.profile || options.network || options.device) {
        const profiles = parseProfileFlag(options.profile);
        if (profiles.length > 0) {
            for (const p of profiles) {
                resolved.runs.push({ profile: p, network: options.network || undefined, device: options.device || undefined });
            }
        } else {
            resolved.runs.push({ profile: undefined, network: options.network || undefined, device: options.device || undefined });
        }
        return resolved;
    }

    // Interactive path: no flags provided
    assertTTY();
    const profileChoices = [
        { name: 'all        Run all profiles (low, medium, high, native)', value: 'all' },
        ...Object.entries(PROFILES).map(([name, p]) => ({
            name: `${name.padEnd(10)} ${p.label}`,
            value: name,
        })),
        { name: '(custom)   Custom network/device settings', value: 'custom' },
    ];

    const { profiles } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'profiles',
            message: 'Simulation profile(s):',
            choices: profileChoices,
            validate: (v) => v.length > 0 || 'Select at least one option',
        },
    ]);

    let selectedProfiles = profiles;
    if (selectedProfiles.includes('all')) {
        selectedProfiles = [...new Set([...Object.keys(PROFILES), ...selectedProfiles.filter((p) => p === 'custom')])];
    }

    let customNetwork;
    let customDevice;
    if (selectedProfiles.includes('custom')) {
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
        customNetwork = answers.network || undefined;
        customDevice = answers.device || undefined;
    }

    for (const p of selectedProfiles) {
        if (p === 'custom') {
            resolved.runs.push({ profile: undefined, network: customNetwork, device: customDevice });
        } else {
            resolved.runs.push({ profile: p, network: undefined, device: undefined });
        }
    }

    return resolved;
}

async function promptRum(url, options) {
    assertTTY();
    const resolved = { apiKey: null, urls: [], categories: undefined, concurrency: options.concurrency, delay: options.delay };

    // Resolve API key: flag > file flag > env key > env path > prompt(key) > prompt(path)
    let apiKey = resolveRumApiKey(options);
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
                validate: (v) => validateFilePath(v, 'API key or file path is required'),
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

    if (resolved.urls.length > 1) {
        if (resolved.concurrency == null) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'concurrency',
                    message: 'Max parallel requests (Enter = 5):',
                    validate: validatePositiveInt,
                },
            ]);
            resolved.concurrency = answers.concurrency.trim() ? parseInt(answers.concurrency, 10) : 5;
        }

        if (resolved.delay == null) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'delay',
                    message: 'Delay between requests per worker in ms (Enter = no delay):',
                    validate: validateNonNegativeInt,
                },
            ]);
            resolved.delay = answers.delay.trim() ? parseInt(answers.delay, 10) : 0;
        }
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
    let cruxAuth = resolveCruxAuth(options);
    if (!cruxAuth) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'keyPath',
                message: 'Path to BigQuery service account JSON:',
                validate: validateFilePath,
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
                validate: validatePositiveInt,
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
                validate: validateNonNegativeInt,
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
    parseProfileFlag,
    validateUrl,
    validatePositiveInt,
    validateNonNegativeInt,
    validateFilePath,
    resolveRumApiKey,
    resolveCruxAuth,
};
