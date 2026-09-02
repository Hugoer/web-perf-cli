import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';

const { runCrux, runCruxBatch, runCruxAudit, runCruxAuditBatch, buildRequestBody, CRUX_MAX_REQUESTS_PER_SECOND } = require('./crux');

const MOCK_CRUX_RESPONSE = {
    record: {
        collectionPeriod: { firstDate: {}, lastDate: {} },
        metrics: { largest_contentful_paint: { percentiles: { p75: 2500 } } },
        key: { origin: 'https://example.com' },
    },
};

const mockFetchOk = () => {
    const stub = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_CRUX_RESPONSE),
    });
    vi.stubGlobal('fetch', stub);
    return stub;
};

const mockFetchError = (status = 400, body = 'Bad request') => {
    const stub = vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', stub);
    return stub;
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// ─── Exports ─────────────────────────────────────────────────────────────────
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

describe('exports', () => {
    it('buildRequestBody is exported', () => expect(typeof buildRequestBody).toBe('function'));
    it('runCrux is exported', () => expect(typeof runCrux).toBe('function'));
    it('runCruxBatch is exported', () => expect(typeof runCruxBatch).toBe('function'));
    it('runCruxAudit is exported', () => expect(typeof runCruxAudit).toBe('function'));
    it('runCruxAuditBatch is exported', () => expect(typeof runCruxAuditBatch).toBe('function'));
    it('CRUX_MAX_REQUESTS_PER_SECOND is exported', () => expect(typeof CRUX_MAX_REQUESTS_PER_SECOND).toBe('number'));
});

// ─── runCruxAudit ─────────────────────────────────────────────────────────────

describe('runCruxAudit — pure function', () => {
    it('returns structured output with source, scope, url, metrics', async () => {
        mockFetchOk();
        const result = await runCruxAudit('https://example.com', 'fake-key');
        expect(result.source).toBe('crux-api');
        expect(result.metrics).toEqual(MOCK_CRUX_RESPONSE.record.metrics);
        expect(result.url).toBeDefined();
    });

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runCruxAudit('https://example.com', 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('throws with statusCode on non-ok response', async () => {
        mockFetchError(403, 'Forbidden');
        const err = await runCruxAudit('https://example.com', 'fake-key').catch((e) => e);
        expect(err.statusCode).toBe(403);
    });

    it('throws a friendly message for 404 (no CrUX data)', async () => {
        mockFetchError(404, 'Not found');
        await expect(runCruxAudit('https://example.com', 'fake-key'))
            .rejects.toThrow('No CrUX data found');
    });

    it('uses origin scope when scope=origin', async () => {
        const stub = mockFetchOk();
        await runCruxAudit('https://example.com/page', 'fake-key', { scope: 'origin' });
        const body = JSON.parse(stub.mock.calls[0][1].body);
        expect(body).toHaveProperty('origin');
        expect(body).not.toHaveProperty('url');
    });
});

// ─── runCrux ─────────────────────────────────────────────────────────────────

describe('runCrux — CLI wrapper', () => {
    it('is exported', () => expect(typeof runCrux).toBe('function'));

    it('calls fs.writeFileSync twice (once per default form factor)', async () => {
        mockFetchOk();
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        await runCrux('https://example.com', 'fake-key');
        expect(fsSpy).toHaveBeenCalledTimes(2);
    });

    it('returns an array of output file paths', async () => {
        mockFetchOk();
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const paths = await runCrux('https://example.com', 'fake-key');
        expect(Array.isArray(paths)).toBe(true);
        expect(paths).toHaveLength(2);
        expect(paths[0]).toMatch(/crux.*example/);
    });
});

// ─── runCruxAuditBatch ────────────────────────────────────────────────────────

describe('runCruxAuditBatch — pure batch', () => {
    it('is exported', () => expect(typeof runCruxAuditBatch).toBe('function'));

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runCruxAuditBatch(['https://example.com'], 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('returns array of { url, formFactor, data, error } — 2 URLs × 2 form factors = 4 results', async () => {
        mockFetchOk();
        const results = await runCruxAuditBatch(['https://a.com', 'https://b.com'], 'fake-key');
        expect(results).toHaveLength(4);
        expect(results[0].data).toMatchObject({ source: 'crux-api' });
        expect(results[0].error).toBeNull();
    });

    it('captures errors per URL without throwing', async () => {
        mockFetchError(400, 'Bad request');
        const results = await runCruxAuditBatch(['https://fail.com'], 'fake-key');
        expect(results[0].error).toBeTruthy();
        expect(results[0].data).toBeNull();
    });
});

describe('runCruxBatch — 404 is no-data, not a failure', () => {
    const { runBatch } = require('./utils');

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Drives the real mapping code by stubbing only the HTTP layer. */
    async function batchWith(statusByUrl) {
        vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
            const target = JSON.parse(init.body).url || JSON.parse(init.body).origin;
            const status = statusByUrl[target] ?? 200;
            if (status === 200) {
                return {
                    ok: true,
                    json: async () => ({ record: { metrics: {}, key: {}, collectionPeriod: {} } }),
                };
            }
            return { ok: false, status, text: async () => 'err' };
        });
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        return runCruxBatch(Object.keys(statusByUrl), 'KEY', { formFactors: ['phone'] });
    }

    it('flags a 404 as noData with no error', async () => {
        const results = await batchWith({ 'https://a.example/': 404 });
        expect(results[0].noData).toBe(true);
        expect(results[0].error).toBeNull();
    });

    it('keeps a real error as an error with noData false', async () => {
        // 403 rather than 5xx: withRetry backs off on 5xx and would slow the test to 6s
        const results = await batchWith({ 'https://a.example/': 403 });
        expect(results[0].noData).toBe(false);
        expect(results[0].error).toMatch(/403/);
    });

    it('marks a successful lookup as neither', async () => {
        const results = await batchWith({ 'https://a.example/': 200 });
        expect(results[0].noData).toBe(false);
        expect(results[0].error).toBeNull();
        expect(results[0].outputPath).toBeTruthy();
    });

    it('separates no-data from real failures in the same run', async () => {
        const results = await batchWith({
            'https://ok.example/': 200,
            'https://thin.example/': 404,
            'https://broken.example/': 403,
        });
        expect(results.filter((r) => r.noData)).toHaveLength(1);
        expect(results.filter((r) => r.error)).toHaveLength(1);
        expect(results.filter((r) => !r.error && !r.noData)).toHaveLength(1);
    });

    it('preserves statusCode through runBatch so the mapping can classify', async () => {
        const err = Object.assign(new Error('nope'), { statusCode: 404 });
        const results = await runBatch(['x'], async () => {
            throw err; 
        }, { maxRequestsPerSecond: 100 });
        expect(results[0].statusCode).toBe(404);
    });
});
