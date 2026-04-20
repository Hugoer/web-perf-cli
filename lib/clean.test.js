import { describe, it, expect } from 'vitest';

const { cleanLabReport, cleanPsiReport, detectReportType, shouldKeepAudit } = require('./clean');

// Minimal valid audit shapes for shouldKeepAudit tests
const notApplicable = { scoreDisplayMode: 'notApplicable', score: null };
const manual = { scoreDisplayMode: 'manual', score: null };
const nullScore = { scoreDisplayMode: 'informational', score: null };
const failingScore = { scoreDisplayMode: 'numeric', score: 0.5, numericValue: 100 };
const perfectBinary = { scoreDisplayMode: 'binary', score: 1 };
const metricSavings = { scoreDisplayMode: 'metricSavings', score: 1 };
const numericPositive = { scoreDisplayMode: 'numeric', score: 1, numericValue: 200 };
const numericZero = { scoreDisplayMode: 'numeric', score: 1, numericValue: 0 };

describe('shouldKeepAudit', () => {
    it('drops notApplicable audits', () => {
        expect(shouldKeepAudit(notApplicable)).toBe(false);
    });

    it('drops manual audits', () => {
        expect(shouldKeepAudit(manual)).toBe(false);
    });

    it('keeps audits with score === null', () => {
        expect(shouldKeepAudit(nullScore)).toBe(true);
    });

    it('keeps audits with score < 1', () => {
        expect(shouldKeepAudit(failingScore)).toBe(true);
    });

    it('drops perfect-score binary audits (informational noise)', () => {
        expect(shouldKeepAudit(perfectBinary)).toBe(false);
    });

    it('keeps metricSavings audits regardless of score', () => {
        expect(shouldKeepAudit(metricSavings)).toBe(true);
    });

    it('keeps numeric audits with numericValue > 0', () => {
        expect(shouldKeepAudit(numericPositive)).toBe(true);
    });

    it('drops numeric audits with numericValue === 0 and perfect score', () => {
        expect(shouldKeepAudit(numericZero)).toBe(false);
    });
});

// Fixture with all Layer 1 keys
const ROOT_KEYS = ['i18n', 'timing', 'configSettings', 'categoryGroups',
    'stackPacks', 'entities', 'gatherMode', 'userAgent',
    'environment', 'fullPageScreenshot'];

function makeLabReport(overrides = {}) {
    return {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com',
        fetchTime: '2024-01-01T00:00:00.000Z',
        formFactor: 'desktop',
        categories: { performance: { score: 0.8 } },
        i18n: { data: 1 },
        timing: { total: 100 },
        configSettings: { emulatedFormFactor: 'desktop' },
        categoryGroups: { metrics: { title: 'Metrics' } },
        stackPacks: [],
        entities: [],
        gatherMode: 'navigation',
        userAgent: 'Chrome/100',
        environment: { benchmarkIndex: 1000 },
        fullPageScreenshot: { screenshot: 'data...' },
        audits: {
            'first-contentful-paint': { scoreDisplayMode: 'numeric', score: 0.5, numericValue: 2000, description: 'FCP desc' },
            'passes-everything': { scoreDisplayMode: 'binary', score: 1, description: 'All good' },
            'n-a-audit': { scoreDisplayMode: 'notApplicable', score: null, description: 'N/A desc' },
        },
        ...overrides,
    };
}

describe('cleanLabReport', () => {
    it('drops all Layer 1 root keys', () => {
        const result = cleanLabReport(makeLabReport());
        for (const key of ROOT_KEYS) {
            expect(result).not.toHaveProperty(key);
        }
    });

    it('preserves requestedUrl, finalUrl, fetchTime, formFactor, categories', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result.requestedUrl).toBe('https://example.com');
        expect(result.finalUrl).toBe('https://example.com');
        expect(result.fetchTime).toBe('2024-01-01T00:00:00.000Z');
        expect(result.formFactor).toBe('desktop');
        expect(result.categories).toEqual({ performance: { score: 0.8 } });
    });

    it('adds _clean: true root marker', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result._clean).toBe(true);
    });

    it('drops notApplicable audits', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result.audits).not.toHaveProperty('n-a-audit');
    });

    it('drops perfect-score informational audits', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result.audits).not.toHaveProperty('passes-everything');
    });

    it('keeps failing audits', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result.audits).toHaveProperty('first-contentful-paint');
    });

    it('drops description from kept audits', () => {
        const result = cleanLabReport(makeLabReport());
        expect(result.audits['first-contentful-paint']).not.toHaveProperty('description');
    });

    it('is idempotent (applying twice = applying once)', () => {
        const once = cleanLabReport(makeLabReport());
        const twice = cleanLabReport(once);
        expect(twice).toEqual(once);
    });

    it('does not mutate input', () => {
        const input = makeLabReport();
        const inputCopy = JSON.parse(JSON.stringify(input));
        cleanLabReport(input);
        expect(input).toEqual(inputCopy);
    });

    it('returns non-object input unchanged', () => {
        expect(cleanLabReport(null)).toBeNull();
        expect(cleanLabReport('string')).toBe('string');
    });
});

describe('cleanPsiReport', () => {
    function makePsiReport(overrides = {}) {
        return {
            captchaResult: 'CAPTCHA_NOT_NEEDED',
            kind: 'pagespeedonline#result',
            analysisUTCTimestamp: '2024-01-01T00:00:00.000Z',
            id: 'https://example.com',
            loadingExperience: { metrics: {} },
            originLoadingExperience: { metrics: {} },
            version: { major: 8, minor: 0 },
            lighthouseResult: makeLabReport(),
            ...overrides,
        };
    }

    it('drops captchaResult, kind, analysisUTCTimestamp', () => {
        const result = cleanPsiReport(makePsiReport());
        expect(result).not.toHaveProperty('captchaResult');
        expect(result).not.toHaveProperty('kind');
        expect(result).not.toHaveProperty('analysisUTCTimestamp');
    });

    it('keeps loadingExperience and originLoadingExperience', () => {
        const result = cleanPsiReport(makePsiReport());
        expect(result).toHaveProperty('loadingExperience');
        expect(result).toHaveProperty('originLoadingExperience');
    });

    it('applies cleanLabReport to lighthouseResult', () => {
        const result = cleanPsiReport(makePsiReport());
        expect(result.lighthouseResult._clean).toBe(true);
        expect(result.lighthouseResult).not.toHaveProperty('i18n');
    });

    it('adds _clean: true root marker', () => {
        const result = cleanPsiReport(makePsiReport());
        expect(result._clean).toBe(true);
    });

    it('returns non-object input unchanged', () => {
        expect(cleanPsiReport(null)).toBeNull();
    });
});

describe('detectReportType', () => {
    it('returns "lab" for lab-* filenames', () => {
        expect(detectReportType('lab-example-2024-01-01-1200.json')).toBe('lab');
    });

    it('returns "psi" for psi-* filenames', () => {
        expect(detectReportType('psi-example-2024-01-01-1200.json')).toBe('psi');
    });

    it('returns null for crux-* filenames', () => {
        expect(detectReportType('crux-example-2024-01-01-1200.json')).toBeNull();
    });

    it('returns null for unknown filenames', () => {
        expect(detectReportType('other-report.json')).toBeNull();
    });
});
