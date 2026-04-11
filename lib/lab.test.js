import { describe, it, expect, vi, afterEach } from 'vitest';

const fs = require('fs');

const { DEFAULT_SKIP_AUDITS, buildLighthouseConfig, runLab, runLabAudit } = require('./lab');
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
