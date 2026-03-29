const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

function ensureModeDir(mode) {
  const dir = path.join(RESULTS_DIR, mode);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatDate() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${date}-${hours}${mins}`;
}

function buildFilename(url, mode) {
  const hostname = new URL(url).hostname;
  return path.join(RESULTS_DIR, mode, `${mode}-${hostname}-${formatDate()}.json`);
}

module.exports = { ensureModeDir, buildFilename, RESULTS_DIR };
