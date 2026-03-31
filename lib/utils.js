const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

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

function buildFilename(url, command) {
    const hostname = new URL(url).hostname;
    const base = path.join(RESULTS_DIR, command, `${command}-${hostname}-${formatDate()}`);
    if (!fs.existsSync(`${base}.json`)) {
        return `${base}.json`;
    }
    let i = 1;
    while (fs.existsSync(`${base}_${String(i).padStart(2, '0')}.json`)) {
        i++;
    }
    return `${base}_${String(i).padStart(2, '0')}.json`;
}

module.exports = { ensureCommandDir, buildFilename, formatDate, RESULTS_DIR };
