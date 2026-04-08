const fs = require('fs');

const logger = require('./logger');
const { PROFILES, NETWORK_PRESETS, DEVICE_PRESETS } = require('./profiles');

// Lazy-load inquirer (~230ms cold require) — only needed when prompts actually run
let _inquirer;
function getInquirer() {
    if (!_inquirer) {
        _inquirer = require('inquirer');
    }
    return _inquirer;
}
const inquirer = new Proxy({}, { get: (_, prop) => getInquirer()[prop] });

// All audits available for skipping in interactive prompt
const SKIPPABLE_AUDITS = [
    { id: 'full-page-screenshot', label: 'Full-page screenshot capture', defaultSkip: true },
    { id: 'screenshot-thumbnails', label: 'Filmstrip thumbnail screenshots', defaultSkip: true },
    { id: 'final-screenshot', label: 'Final rendered state screenshot', defaultSkip: true },
    { id: 'valid-source-maps', label: 'Source map validation check', defaultSkip: true },
    { id: 'script-treemap-data', label: 'JS treemap/bundle data (often the largest audit)', defaultSkip: false },
    { id: 'network-requests', label: 'Full network request log', defaultSkip: false },
    { id: 'main-thread-tasks', label: 'Detailed main-thread task breakdown', defaultSkip: false },
    { id: 'third-party-summary', label: 'Third-party resource analysis', defaultSkip: false },
    { id: 'layout-shifts', label: 'Individual CLS shift elements', defaultSkip: false },
    { id: 'long-tasks', label: 'Long main-thread tasks list', defaultSkip: false },
    { id: 'bf-cache', label: 'Back/forward cache eligibility', defaultSkip: false },
    { id: 'resource-summary', label: 'Resource count and size summary', defaultSkip: false },
];

const DEFAULT_CONCURRENCY = 5;

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

function stripQueryAndHash(rawUrl) {
    try {
        const u = new URL(rawUrl);
        u.search = '';
        u.hash = '';
        return u.toString();
    } catch {
        return rawUrl;
    }
}

function normalizeUrls(urls) {
    const cleaned = urls.map(stripQueryAndHash);
    const unique = [...new Set(cleaned)];
    const stripped = urls.filter((u) => {
        try {
            const p = new URL(u); return p.search !== '' || p.hash !== '';
        } catch {
            return false;
        }
    }).length;
    const dupes = cleaned.length - unique.length;
    if (stripped > 0 || dupes > 0) {
        const parts = [];
        if (stripped > 0) {
            parts.push(`${stripped} URL(s) cleaned (query/hash removed)`);
        }
        if (dupes > 0) {
            parts.push(`${dupes} duplicate(s) removed`);
        }
        logger.info(`URL normalization: ${parts.join(', ')}`);
        unique.forEach((u) => logger.info(`  → ${u}`));
    }
    return unique;
}

function resolvePsiApiKey(options) {
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

function resolveCruxApiKey(options) {
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

async function promptForSubcommand() {
    assertTTY();
    const { command } = await inquirer.prompt([
        {
            type: 'list',
            name: 'command',
            message: 'What would you like to do?',
            choices: [
                { name: 'lab                — Run a local Lighthouse audit', value: 'lab' },
                { name: 'psi                — Fetch PageSpeed Insights data', value: 'psi' },
                { name: 'crux               — Extract CrUX data via CrUX API', value: 'crux' },
                { name: 'crux-history       — Historical CrUX data via CrUX API', value: 'crux-history' },
                { name: 'sitemap            — Extract URLs from sitemap.xml', value: 'sitemap' },
                { name: 'links              — Extract internal links from rendered DOM', value: 'links' },
            ],
        },
    ]);
    return command;
}

function parseSkipAuditsFlag(skipAuditsStr) {
    if (!skipAuditsStr) {
        return undefined;
    }
    return skipAuditsStr.split(',').map((a) => a.trim()).filter(Boolean);
}

function parseBlockedUrlPatternsFlag(patternsStr) {
    if (!patternsStr) {
        return undefined;
    }
    return [...new Set(patternsStr.split(',').map((p) => p.trim()).filter(Boolean))];
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
    resolved.urls = normalizeUrls(urls);

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

    // Skip audits selection (only in interactive mode, not when --skip-audits flag is used)
    if (!options.skipAudits) {
        const skipAuditChoices = SKIPPABLE_AUDITS.map((a) => ({
            name: a.id,
            value: a.id,
            checked: a.defaultSkip,
        }));

        const { skipAudits } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'skipAudits',
                message: 'Audits to skip:',
                choices: skipAuditChoices,
            },
        ]);
        resolved.skipAudits = skipAudits;
    }

    // Blocked URL patterns (only in interactive mode, not when --blocked-url-patterns flag is used)
    if (!options.blockedUrlPatterns) {
        const { blockedUrlPatternsInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'blockedUrlPatternsInput',
                message: 'URL patterns to block (comma-separated, blank for none):',
            },
        ]);
        if (blockedUrlPatternsInput) {
            resolved.blockedUrlPatterns = blockedUrlPatternsInput.split(',').map((p) => p.trim()).filter(Boolean);
        }
    }

    return resolved;
}

async function promptPsi(url, options) {
    const resolved = { apiKey: null, urls: [], categories: undefined, concurrency: options.concurrency, delay: options.delay };

    // Resolve API key: flag > file flag > env key > env path > prompt(key) > prompt(path)
    let apiKey = resolvePsiApiKey(options);
    if (!apiKey) {
        assertTTY();
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
        assertTTY();
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
        assertTTY();
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
    resolved.urls = normalizeUrls(urls);

    // Resolve categories: flag > prompt
    if (options.category) {
        resolved.categories = options.category.split(',').map((c) => c.trim().toUpperCase().replace(/-/g, '_'));
    } else {
        assertTTY();
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

    if (resolved.urls.length >= DEFAULT_CONCURRENCY) {
        if (resolved.concurrency == null) {
            if (process.stdin.isTTY) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'concurrency',
                        message: `Max parallel requests (Enter = ${DEFAULT_CONCURRENCY}):`,
                        validate: validatePositiveInt,
                    },
                ]);
                resolved.concurrency = answers.concurrency.trim() ? parseInt(answers.concurrency, 10) : DEFAULT_CONCURRENCY;
            } else {
                resolved.concurrency = DEFAULT_CONCURRENCY;
            }
        }

        if (resolved.delay == null) {
            if (process.stdin.isTTY) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'delay',
                        message: 'Delay between requests per worker in ms (Enter = no delay):',
                        validate: validateNonNegativeInt,
                    },
                ]);
                resolved.delay = answers.delay.trim() ? parseInt(answers.delay, 10) : 0;
            } else {
                resolved.delay = 0;
            }
        }
    }

    return resolved;
}

async function promptCrux(url, options) {
    const hasUrlList = Boolean(options.urls || options.urlsFile);
    const resolved = {
        apiKey: null,
        urls: [],
        scope: options.scope || (hasUrlList ? 'page' : null),
        concurrency: options.concurrency,
        delay: options.delay,
    };

    // Resolve scope: flag > interactive prompt
    if (!resolved.scope) {
        if (process.stdin.isTTY) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'scope',
                    message: 'Query scope:',
                    choices: [
                        { name: 'origin  — Origin-level data (28-day rolling average)', value: 'origin' },
                        { name: 'page    — Page-level data (28-day rolling average)', value: 'page' },
                    ],
                    default: 'origin',
                },
            ]);
            resolved.scope = answers.scope;
        } else {
            resolved.scope = 'origin';
        }
    }

    // Resolve URLs: --urls > --urls-file > positional arg > interactive prompt
    const urls = [];
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
        const message = resolved.scope === 'origin' ? 'Origin to query (e.g. https://example.com):' : 'URLs to query (comma-separated):';
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'urls',
                message,
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
    resolved.urls = normalizeUrls(urls);

    // Resolve API key: flag > file flag > env key > env path > prompt
    let apiKey = resolveCruxApiKey(options);
    if (!apiKey) {
        assertTTY();
        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'CrUX API key (Enter to provide file path instead):',
                mask: '*',
            },
        ]);
        apiKey = answers.apiKey;
    }
    if (!apiKey) {
        assertTTY();
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

    // Concurrency and delay for multi-URL (page scope only)
    if (resolved.urls.length >= DEFAULT_CONCURRENCY) {
        if (resolved.concurrency == null) {
            if (process.stdin.isTTY) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'concurrency',
                        message: `Max parallel requests (Enter = ${DEFAULT_CONCURRENCY}):`,
                        validate: validatePositiveInt,
                    },
                ]);
                resolved.concurrency = answers.concurrency.trim() ? parseInt(answers.concurrency, 10) : DEFAULT_CONCURRENCY;
            } else {
                resolved.concurrency = DEFAULT_CONCURRENCY;
            }
        }

        if (resolved.delay == null) {
            if (process.stdin.isTTY) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'delay',
                        message: 'Delay between requests per worker in ms (Enter = no delay):',
                        validate: validateNonNegativeInt,
                    },
                ]);
                resolved.delay = answers.delay.trim() ? parseInt(answers.delay, 10) : 0;
            } else {
                resolved.delay = 0;
            }
        }
    }

    return resolved;
}

async function promptCruxHistory(url, options) {
    return promptCrux(url, options);
}

async function promptSitemap(url, options) {
    assertTTY();
    const resolved = { url, depth: options.depth, delay: options.delay, outputAi: options.outputAi || false };

    if (!resolved.url) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'Domain or sitemap URL (e.g. example.com or example.com/sitemap-pages.xml):', validate: validateUrl },
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

    if (!resolved.outputAi) {
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'outputAi',
                message: 'Generate AI-friendly output?',
                default: false,
            },
        ]);
        resolved.outputAi = answers.outputAi;
    }

    return resolved;
}

async function promptLinks(url, options = {}) {
    assertTTY();
    const resolved = { url, outputAi: options.outputAi || false };

    if (!resolved.url) {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'url', message: 'URL to extract links from:', validate: validateUrl },
        ]);
        resolved.url = answers.url;
    }

    if (!resolved.outputAi) {
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'outputAi',
                message: 'Generate AI-friendly output?',
                default: false,
            },
        ]);
        resolved.outputAi = answers.outputAi;
    }

    return resolved;
}

module.exports = {
    DEFAULT_CONCURRENCY,
    SKIPPABLE_AUDITS,
    normalizeUrls,
    promptForSubcommand,
    promptLab,
    promptPsi,
    promptCrux,
    promptCruxHistory,
    promptSitemap,
    promptLinks,
    parseProfileFlag,
    parseSkipAuditsFlag,
    parseBlockedUrlPatternsFlag,
    validateUrl,
    validatePositiveInt,
    validateNonNegativeInt,
    validateFilePath,
    resolvePsiApiKey,
    resolveCruxApiKey,
};
