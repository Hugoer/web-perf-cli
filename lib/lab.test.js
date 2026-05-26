import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('chrome-launcher', () => ({ default: { launch: vi.fn().mockResolvedValue({ port: 9999, kill: vi.fn() }) } }));
vi.mock('lighthouse', () => ({ default: vi.fn().mockRejectedValue(new Error('lighthouse mock: no real browser')) }));

const fs = require('fs');

const { DEFAULT_SKIP_AUDITS, buildLighthouseConfig, runLab, runLabAudit, writeLabResult } = require('./lab');
const { SKIPPABLE_AUDITS } = require('./prompts');
const utils = require('./utils');

describe('DEFAULT_SKIP_AUDITS', () => {
    it('should contain the expected default audit IDs', () => {
        expect(DEFAULT_SKIP_AUDITS).toEqual([
            'full-page-screenshot',
            'screenshot-thumbnails',
            'final-screenshot',
            'valid-source-maps',
        ]);
    });

    it('should match all SKIPPABLE_AUDITS entries with defaultSkip: true', () => {
        const expectedDefaults = SKIPPABLE_AUDITS.filter((a) => a.defaultSkip).map((a) => a.id);
        expect(DEFAULT_SKIP_AUDITS).toEqual(expectedDefaults);
    });
});

describe('SKIPPABLE_AUDITS', () => {
    it('should have unique IDs', () => {
        const ids = SKIPPABLE_AUDITS.map((a) => a.id);
        expect(ids).toEqual([...new Set(ids)]);
    });

    it('should have required fields on every entry', () => {
        for (const audit of SKIPPABLE_AUDITS) {
            expect(audit).toHaveProperty('id');
            expect(audit).toHaveProperty('label');
            expect(audit).toHaveProperty('defaultSkip');
            expect(typeof audit.id).toBe('string');
            expect(typeof audit.label).toBe('string');
            expect(typeof audit.defaultSkip).toBe('boolean');
        }
    });
});

describe('runLab Lighthouse config', () => {
    it('translates full-page-screenshot to disableFullPageScreenshot: true', () => {
        const config = buildLighthouseConfig({
            skipAudits: ['full-page-screenshot', 'screenshot-thumbnails'],
        });
        expect(config.settings.disableFullPageScreenshot).toBe(true);
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails']);
        expect(config.settings.skipAudits).not.toContain('full-page-screenshot');
    });

    it('does not set disableFullPageScreenshot when full-page-screenshot is absent', () => {
        const config = buildLighthouseConfig({
            skipAudits: ['screenshot-thumbnails', 'final-screenshot'],
        });
        expect(config.settings.disableFullPageScreenshot).toBeUndefined();
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails', 'final-screenshot']);
    });

    it('applies disableFullPageScreenshot via DEFAULT_SKIP_AUDITS', () => {
        const config = buildLighthouseConfig({});
        expect(config.settings.disableFullPageScreenshot).toBe(true);
        expect(config.settings.skipAudits).not.toContain('full-page-screenshot');
    });
});

describe('runLab Lighthouse config — category filtering', () => {
    it('sets onlyCategories for a proper subset', () => {
        const config = buildLighthouseConfig({ categories: ['performance', 'seo'] });
        expect(config.settings.onlyCategories).toEqual(['performance', 'seo']);
    });

    it('sets onlyCategories when filtering to a single category (agentic-browsing)', () => {
        const config = buildLighthouseConfig({ categories: ['agentic-browsing'] });
        expect(config.settings.onlyCategories).toEqual(['agentic-browsing']);
    });

    it('omits onlyCategories when all five categories are selected (Lighthouse default)', () => {
        const config = buildLighthouseConfig({
            categories: ['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing'],
        });
        expect(config.settings.onlyCategories).toBeUndefined();
    });

    it('omits onlyCategories when categories is empty or undefined', () => {
        expect(buildLighthouseConfig({ categories: [] }).settings.onlyCategories).toBeUndefined();
        expect(buildLighthouseConfig({}).settings.onlyCategories).toBeUndefined();
    });

    it('composes onlyCategories with profile settings and skipAudits', () => {
        const config = buildLighthouseConfig(
            { categories: ['performance'], skipAudits: ['screenshot-thumbnails'] },
            { formFactor: 'desktop' },
        );
        expect(config.settings.onlyCategories).toEqual(['performance']);
        expect(config.settings.formFactor).toBe('desktop');
        expect(config.settings.skipAudits).toEqual(['screenshot-thumbnails']);
    });
});

describe('runLabAudit — I/O isolation', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is exported from the module', () => {
        expect(typeof runLabAudit).toBe('function');
    });

    it('does NOT call fs.writeFileSync (pure — no disk I/O)', async () => {
        const spy = vi.spyOn(fs, 'writeFileSync');
        // port: 9999 skips Chrome launch; lighthouse fails in ~800ms — fast & deterministic
        await expect(runLabAudit('https://example.com', { port: 9999 })).rejects.toThrow();
        expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT call ensureCommandDir (no CLI setup)', async () => {
        const spy = vi.spyOn(utils, 'ensureCommandDir');
        await expect(runLabAudit('https://example.com', { port: 9999 })).rejects.toThrow();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('runLab — regression (CLI wrapper)', () => {
    it('is exported from the module', () => {
        expect(typeof runLab).toBe('function');
    });
});

describe('writeLabResult — --clean flag', () => {
    const RAW_PATH = '/tmp/results/lab/lab-example.com-2024-01-01-120000.json';
    const MOCK_DATA = { requestedUrl: 'https://example.com', audits: {} };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('writes only raw file when clean is not set', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, {});
        expect(fsSpy).toHaveBeenCalledOnce();
    });

    it('writes raw and clean files when clean: true', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        expect(fsSpy).toHaveBeenCalledTimes(2);
        const cleanCall = fsSpy.mock.calls.find((c) => c[0].includes('clean'));
        expect(cleanCall).toBeDefined();
        expect(cleanCall[0]).toMatch(/\.clean\.json$/);
        const written = JSON.parse(cleanCall[1]);
        expect(written._clean).toBe(true);
    });

    it('clean output path is under a clean/ subfolder of the raw output dir', () => {
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        const rawCall = fsSpy.mock.calls.find((c) => !c[0].includes('clean'));
        const cleanCall = fsSpy.mock.calls.find((c) => c[0].includes('clean'));
        const rawDir = require('path').dirname(rawCall[0]);
        const cleanDir = require('path').dirname(cleanCall[0]);
        expect(cleanDir).toBe(require('path').join(rawDir, 'clean'));
    });

    it('creates clean/ dir before writing', () => {
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        writeLabResult(RAW_PATH, MOCK_DATA, { clean: true });
        const cleanDir = require('path').join(require('path').dirname(RAW_PATH), 'clean');
        expect(mkdirSpy).toHaveBeenCalledWith(cleanDir, { recursive: true });
    });
});
