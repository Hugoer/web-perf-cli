const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function ensureCommandDir(command) {
    const dir = path.join(RESULTS_DIR, command);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function formatDate() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = String(now.getUTCSeconds()).padStart(2, '0');
    return `${date}-${hours}${mins}${secs}`;
}

function buildFilename(url, command, suffix, ext = 'json') {
    const hostname = new URL(url).hostname;
    const suffixPart = suffix ? `-${suffix}` : '';
    const base = path.join(RESULTS_DIR, command, `${command}-${hostname}-${formatDate()}${suffixPart}`);
    if (!fs.existsSync(`${base}.${ext}`)) {
        return `${base}.${ext}`;
    }
    let i = 1;
    while (fs.existsSync(`${base}_${String(i).padStart(2, '0')}.${ext}`)) {
        i++;
    }
    return `${base}_${String(i).padStart(2, '0')}.${ext}`;
}

function formatElapsed(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function normalizeOrigin(url) {
    const full = url.startsWith('http') ? url : `https://${url}`;
    return new URL(full).origin;
}

function normalizeUrlForAi(url) {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

function writeAiOutput(urls, referenceUrl, command) {
    ensureCommandDir(command);
    const normalized = urls.map(normalizeUrlForAi);
    const unique = [...new Set(normalized)];
    const outputPath = buildFilename(referenceUrl, command, undefined, 'txt');
    fs.writeFileSync(outputPath, unique.join('\n'));
    return outputPath;
}

function createRateLimiter({ maxRequestsPerSecond }) {
    if (!Number.isFinite(maxRequestsPerSecond) || maxRequestsPerSecond <= 0) {
        throw new Error('maxRequestsPerSecond must be a positive number');
    }

    const minIntervalMs = Math.ceil(1000 / maxRequestsPerSecond);
    let nextAllowedAt = 0;
    let lock = Promise.resolve();

    return async function waitForTurn() {
        let release;
        const previous = lock;
        lock = new Promise((resolve) => {
            release = resolve;
        });

        await previous;
        try {
            const slotTime = Math.max(nextAllowedAt, Date.now());
            const waitMs = slotTime - Date.now();
            if (waitMs > 0) {
                await sleep(waitMs);
            }
            nextAllowedAt = slotTime + minIntervalMs;
        } finally {
            release();
        }
    };
}

module.exports = {
    ensureCommandDir,
    buildFilename,
    formatDate,
    formatElapsed,
    normalizeOrigin,
    normalizeUrlForAi,
    writeAiOutput,
    createRateLimiter,
    sleep,
    RESULTS_DIR,
};
