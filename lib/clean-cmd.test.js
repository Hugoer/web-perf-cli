import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { runCleanCmd } = require('./clean-cmd');

const LAB_REPORT = {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    fetchTime: '2024-01-01T00:00:00.000Z',
    formFactor: 'desktop',
    categories: { performance: { score: 0.8 } },
    audits: {
        'first-contentful-paint': { scoreDisplayMode: 'numeric', score: 0.5, numericValue: 2000, description: 'FCP' },
    },
};

const PSI_REPORT = {
    id: 'https://example.com',
    kind: 'pagespeedonline#result',
    captchaResult: 'CAPTCHA_NOT_NEEDED',
    analysisUTCTimestamp: '2024-01-01T00:00:00.000Z',
    loadingExperience: {},
    lighthouseResult: LAB_REPORT,
};

let tmpDir;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-cmd-test-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeJson(dir, filename, data) {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
}

describe('runCleanCmd — single file', () => {
    it('cleans a lab file and writes to clean/ subfolder', async () => {
        const filePath = writeJson(tmpDir, 'lab-example.com-2024-01-01-120000.json', LAB_REPORT);
        const result = await runCleanCmd(filePath);
        expect(result.cleaned).toEqual([filePath]);
        expect(result.skipped).toHaveLength(0);
        expect(result.errored).toHaveLength(0);
        const cleanPath = path.join(tmpDir, 'clean', 'lab-example.com-2024-01-01-120000.clean.json');
        expect(fs.existsSync(cleanPath)).toBe(true);
        const written = JSON.parse(fs.readFileSync(cleanPath, 'utf-8'));
        expect(written._clean).toBe(true);
    });

    it('cleans a psi file and writes to clean/ subfolder', async () => {
        const filePath = writeJson(tmpDir, 'psi-example.com-2024-01-01-120000.json', PSI_REPORT);
        const result = await runCleanCmd(filePath);
        expect(result.cleaned).toEqual([filePath]);
        const cleanPath = path.join(tmpDir, 'clean', 'psi-example.com-2024-01-01-120000.clean.json');
        const written = JSON.parse(fs.readFileSync(cleanPath, 'utf-8'));
        expect(written._clean).toBe(true);
        expect(written).not.toHaveProperty('captchaResult');
    });

    it('skips files with unknown prefix and returns them in skipped', async () => {
        const filePath = writeJson(tmpDir, 'crux-example.com-2024.json', { data: 1 });
        const result = await runCleanCmd(filePath);
        expect(result.skipped).toEqual([filePath]);
        expect(result.cleaned).toHaveLength(0);
    });

    it('skips existing .clean.json output (does not overwrite)', async () => {
        const filePath = writeJson(tmpDir, 'lab-example.com-2024-01-01-120000.json', LAB_REPORT);
        const cleanDir = path.join(tmpDir, 'clean');
        fs.mkdirSync(cleanDir, { recursive: true });
        const existing = writeJson(cleanDir, 'lab-example.com-2024-01-01-120000.clean.json', { _clean: true, existing: true });
        const result = await runCleanCmd(filePath);
        expect(result.skipped).toEqual([filePath]);
        const written = JSON.parse(fs.readFileSync(existing, 'utf-8'));
        expect(written.existing).toBe(true);
    });

    it('records error and continues on malformed JSON', async () => {
        const filePath = path.join(tmpDir, 'lab-bad.json');
        fs.writeFileSync(filePath, 'not valid json {{{');
        const result = await runCleanCmd(filePath);
        expect(result.errored).toEqual([filePath]);
        expect(result.cleaned).toHaveLength(0);
    });
});

describe('runCleanCmd — directory input', () => {
    it('processes all .json files in a directory', async () => {
        writeJson(tmpDir, 'lab-a.json', LAB_REPORT);
        writeJson(tmpDir, 'lab-b.json', LAB_REPORT);
        const result = await runCleanCmd(tmpDir);
        expect(result.cleaned).toHaveLength(2);
    });

    it('skips .clean.json files already in the directory', async () => {
        writeJson(tmpDir, 'lab-a.json', LAB_REPORT);
        writeJson(tmpDir, 'lab-a.clean.json', { _clean: true });
        const result = await runCleanCmd(tmpDir);
        expect(result.cleaned).toHaveLength(1);
        expect(result.skipped).toHaveLength(1);
    });

    it('does not recurse into clean/ subfolder (readdirSync is one level only)', async () => {
        const cleanDir = path.join(tmpDir, 'clean');
        fs.mkdirSync(cleanDir);
        writeJson(tmpDir, 'lab-a.json', LAB_REPORT);
        writeJson(cleanDir, 'lab-b.json', LAB_REPORT);
        const result = await runCleanCmd(tmpDir);
        expect(result.cleaned).toHaveLength(1);
        expect(result.cleaned[0]).toContain('lab-a.json');
    });
});

describe('runCleanCmd — glob input', () => {
    it('expands a glob pattern and processes matching files', async () => {
        writeJson(tmpDir, 'lab-a.json', LAB_REPORT);
        writeJson(tmpDir, 'lab-b.json', LAB_REPORT);
        const pattern = path.join(tmpDir, 'lab-*.json');
        const result = await runCleanCmd(pattern);
        expect(result.cleaned).toHaveLength(2);
    });

    it('skips clean.json files matched by glob', async () => {
        writeJson(tmpDir, 'lab-a.json', LAB_REPORT);
        writeJson(tmpDir, 'lab-a.clean.json', { _clean: true });
        const pattern = path.join(tmpDir, '*.json');
        const result = await runCleanCmd(pattern);
        expect(result.cleaned).toHaveLength(1);
        expect(result.skipped).toHaveLength(1);
    });
});
