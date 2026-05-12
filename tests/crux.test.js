import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');

const { buildRequestBody, runCruxAudit, runCruxBatch, CRUX_FORM_FACTORS, DEFAULT_CRUX_FORM_FACTORS } = require('../lib/crux');
const { parseCruxFormFactors } = require('../lib/prompts');

// ─── buildRequestBody ─────────────────────────────────────────────────────────

describe('buildRequestBody', () => {
    it('produces { url } for page scope with no form factor', () => {
        const body = buildRequestBody('https://example.com', 'page');
        expect(body).toEqual({ url: 'https://example.com' });
    });

    it('produces { origin } for origin scope with no form factor', () => {
        const body = buildRequestBody('https://example.com/path', 'origin');
        expect(body).toEqual({ origin: 'https://example.com' });
    });

    it('adds formFactor in uppercase when provided', () => {
        const phone = buildRequestBody('https://example.com', 'page', 'phone');
        expect(phone.formFactor).toBe('PHONE');

        const desktop = buildRequestBody('https://example.com', 'page', 'desktop');
        expect(desktop.formFactor).toBe('DESKTOP');

        const tablet = buildRequestBody('https://example.com', 'page', 'tablet');
        expect(tablet.formFactor).toBe('TABLET');
    });

    it('omits formFactor from body when not provided', () => {
        const body = buildRequestBody('https://example.com', 'page');
        expect(Object.prototype.hasOwnProperty.call(body, 'formFactor')).toBe(false);
    });
});

// ─── runCruxAudit ─────────────────────────────────────────────────────────────

describe('runCruxAudit', () => {
    let fetchSpy;

    const makeApiResponse = (formFactor) => ({
        record: {
            key: { url: 'https://example.com', formFactor },
            collectionPeriod: { firstDate: {}, lastDate: {} },
            metrics: {},
        },
    });

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(makeApiResponse('PHONE')),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends formFactor=PHONE in request body when formFactor=phone', async () => {
        await runCruxAudit('https://example.com', 'key', { scope: 'page', formFactor: 'phone' });

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [, init] = fetchSpy.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.formFactor).toBe('PHONE');
    });

    it('sends formFactor=DESKTOP in request body when formFactor=desktop', async () => {
        await runCruxAudit('https://example.com', 'key', { scope: 'page', formFactor: 'desktop' });

        const [, init] = fetchSpy.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.formFactor).toBe('DESKTOP');
    });

    it('omits formFactor from body when not provided', async () => {
        await runCruxAudit('https://example.com', 'key', { scope: 'page' });

        const [, init] = fetchSpy.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(Object.prototype.hasOwnProperty.call(body, 'formFactor')).toBe(false);
    });

    it('includes formFactor in the returned report', async () => {
        const result = await runCruxAudit('https://example.com', 'key', { scope: 'page', formFactor: 'phone' });
        expect(result.formFactor).toBe('phone');
    });

    it('sets formFactor to null in the returned report when not provided', async () => {
        const result = await runCruxAudit('https://example.com', 'key', { scope: 'page' });
        expect(result.formFactor).toBeNull();
    });
});

// ─── runCruxBatch ─────────────────────────────────────────────────────────────

describe('runCruxBatch', () => {
    let fetchSpy;
    let writeSpy;

    const makeApiResponse = () => ({
        record: {
            key: { url: 'https://example.com' },
            collectionPeriod: { firstDate: {}, lastDate: {} },
            metrics: {},
        },
    });

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(makeApiResponse()),
        });
        writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
        vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fires 2 requests per URL for the default form factors (phone + desktop)', async () => {
        await runCruxBatch(['https://example.com'], 'key', { scope: 'page' });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('fires 1 request per URL when only phone is requested', async () => {
        await runCruxBatch(['https://example.com'], 'key', { scope: 'page', formFactors: ['phone'] });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('fires 3 requests per URL when phone, desktop, and tablet are all requested', async () => {
        await runCruxBatch(['https://example.com'], 'key', { scope: 'page', formFactors: ['phone', 'desktop', 'tablet'] });
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('fires N × formFactors requests for a batch of N URLs', async () => {
        const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
        await runCruxBatch(urls, 'key', { scope: 'page', formFactors: ['phone', 'desktop'] });
        expect(fetchSpy).toHaveBeenCalledTimes(6);
    });

    it('writes files with -phone and -desktop suffixes for default form factors', async () => {
        await runCruxBatch(['https://example.com'], 'key', { scope: 'page' });

        const writtenPaths = writeSpy.mock.calls.map(([p]) => p);
        expect(writtenPaths.some((p) => p.includes('-phone'))).toBe(true);
        expect(writtenPaths.some((p) => p.includes('-desktop'))).toBe(true);
    });

    it('returns results with formFactor field for each work item', async () => {
        const results = await runCruxBatch(['https://example.com'], 'key', { scope: 'page' });
        expect(results).toHaveLength(2);
        const formFactors = results.map((r) => r.formFactor).sort();
        expect(formFactors).toEqual(['desktop', 'phone']);
    });

    it('reports failures independently per (url, formFactor) pair', async () => {
        let callCount = 0;
        fetchSpy.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const err = new Error('phone failed');
                err.statusCode = 404;
                return Promise.reject(err);
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(makeApiResponse()),
            });
        });

        const results = await runCruxBatch(['https://example.com'], 'key', {
            scope: 'page',
            formFactors: ['phone', 'desktop'],
        });

        expect(results).toHaveLength(2);
        const phoneResult = results.find((r) => r.formFactor === 'phone');
        const desktopResult = results.find((r) => r.formFactor === 'desktop');
        expect(phoneResult.error).toBeTruthy();
        expect(desktopResult.error).toBeNull();
    });
});

// ─── parseCruxFormFactors ─────────────────────────────────────────────────────

describe('parseCruxFormFactors', () => {
    it('returns default form factors when no input is given', () => {
        expect(parseCruxFormFactors(undefined)).toEqual(['phone', 'desktop']);
        expect(parseCruxFormFactors('')).toEqual(['phone', 'desktop']);
    });

    it('parses a single form factor', () => {
        expect(parseCruxFormFactors('phone')).toEqual(['phone']);
        expect(parseCruxFormFactors('desktop')).toEqual(['desktop']);
        expect(parseCruxFormFactors('tablet')).toEqual(['tablet']);
    });

    it('parses comma-separated form factors', () => {
        expect(parseCruxFormFactors('phone,desktop')).toEqual(['phone', 'desktop']);
        expect(parseCruxFormFactors('phone,tablet')).toEqual(['phone', 'tablet']);
        expect(parseCruxFormFactors('phone,desktop,tablet')).toEqual(['phone', 'desktop', 'tablet']);
    });

    it('is case-insensitive', () => {
        expect(parseCruxFormFactors('Phone,Desktop')).toEqual(['phone', 'desktop']);
    });

    it('de-duplicates values silently', () => {
        expect(parseCruxFormFactors('phone,phone,desktop')).toEqual(['phone', 'desktop']);
    });

    it('throws on invalid form factor values', () => {
        expect(() => parseCruxFormFactors('mobile')).toThrow('Invalid form factor: "mobile"');
        expect(() => parseCruxFormFactors('phone,tablet,foo')).toThrow('Invalid form factor: "foo"');
    });
});

// ─── constants ────────────────────────────────────────────────────────────────

describe('CrUX form factor constants', () => {
    it('CRUX_FORM_FACTORS includes phone, desktop, tablet', () => {
        expect(CRUX_FORM_FACTORS).toContain('phone');
        expect(CRUX_FORM_FACTORS).toContain('desktop');
        expect(CRUX_FORM_FACTORS).toContain('tablet');
    });

    it('DEFAULT_CRUX_FORM_FACTORS is phone and desktop', () => {
        expect(DEFAULT_CRUX_FORM_FACTORS).toEqual(['phone', 'desktop']);
    });
});
