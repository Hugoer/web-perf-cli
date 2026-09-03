/**
 * @typedef {Object} CleanCmdResult
 * @property {string[]} cleaned
 * @property {string[]} skipped
 * @property {string[]} errored
 */

const fs = require('fs');
const { glob } = require('glob');
const path = require('path');

const { cleanLabReport, cleanPsiReport, detectReportType } = require('./clean');
const logger = require('./logger');

const GLOB_CHARS = /[*?[]/;

function isSkipped(filePath) {
    const parts = filePath.split(path.sep);
    return parts.includes('clean') || path.basename(filePath).endsWith('.clean.json');
}

async function resolveFiles(input) {
    if (GLOB_CHARS.test(input)) {
        return glob(input);
    }
    const stat = fs.statSync(input, { throwIfNoEntry: false });
    if (!stat) {
        return [];
    }
    if (stat.isDirectory()) {
        return fs.readdirSync(input)
            .filter((f) => f.endsWith('.json'))
            .map((f) => path.join(input, f));
    }
    return [input];
}

function processFile(filePath, results) {
    const basename = path.basename(filePath);

    if (isSkipped(filePath)) {
        results.skipped.push(filePath);
        return;
    }

    const type = detectReportType(basename);
    if (!type) {
        logger.info(`Skipping unknown report type: ${basename}`);
        results.skipped.push(filePath);
        return;
    }

    const parentDir = path.dirname(filePath);
    const cleanDir = path.join(parentDir, 'clean');
    const base = path.basename(filePath, '.json');
    const cleanOutputPath = path.join(cleanDir, `${base}.clean.json`);

    if (fs.existsSync(cleanOutputPath)) {
        logger.info(`Already exists, skipping: ${cleanOutputPath}`);
        results.skipped.push(filePath);
        return;
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        logger.error(`Failed to parse ${filePath}: ${err.message}`);
        results.errored.push(filePath);
        return;
    }

    try {
        const cleanData = type === 'psi' ? cleanPsiReport(data) : cleanLabReport(data);
        fs.mkdirSync(cleanDir, { recursive: true });
        fs.writeFileSync(cleanOutputPath, JSON.stringify(cleanData, null, 2));
        results.cleaned.push(filePath);
    } catch (err) {
        logger.error(`Failed to write ${cleanOutputPath}: ${err.message}`);
        results.errored.push(filePath);
    }
}

/**
 * @param {string} input - File path, directory path, or glob pattern
 * @returns {Promise<CleanCmdResult>}
 * @throws {Error} when a non-glob input does not exist on disk
 */
async function runCleanCmd(input) {
    const results = { cleaned: [], skipped: [], errored: [] };

    // Throwing rather than logging: the caller in bin/web-perf.js turns a rejection into a
    // non-zero exit, and a mistyped path that reports "0 succeeded, 0 failed" and exits 0
    // is indistinguishable from a real no-op to any script or CI step.
    //
    // Existence is checked directly rather than inferred from an empty file list, because
    // those are different states: a directory that exists but holds no .json files, and a
    // glob that matches nothing, are both empty result sets rather than missing inputs.
    if (!GLOB_CHARS.test(input) && !fs.existsSync(input)) {
        throw new Error(`Input not found: ${input}`);
    }

    const files = await resolveFiles(input);

    for (const filePath of files) {
        processFile(filePath, results);
    }

    return results;
}

module.exports = { runCleanCmd };
