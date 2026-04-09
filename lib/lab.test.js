import { describe, it, expect } from 'vitest';

const { DEFAULT_SKIP_AUDITS, buildLighthouseConfig } = require('./lab');
const { SKIPPABLE_AUDITS } = require('./prompts');

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
