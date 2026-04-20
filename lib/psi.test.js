import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';

const { runPsi, runPsiBatch, runPsiAudit, runPsiAuditBatch, PSI_MAX_REQUESTS_PER_SECOND } = require('./psi');

const MOCK_API_DATA = { lighthouseResult: { categories: { performance: { score: 0.95 } } } };

const mockFetchOk = () => {
    const stub = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_API_DATA),
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

// ─── Exports ────────────────────────────────────────────────────────────────

describe('exports', () => {
    it('runPsi is exported', () => expect(typeof runPsi).toBe('function'));
    it('runPsiBatch is exported', () => expect(typeof runPsiBatch).toBe('function'));
    it('runPsiAudit is exported', () => expect(typeof runPsiAudit).toBe('function'));
    it('runPsiAuditBatch is exported', () => expect(typeof runPsiAuditBatch).toBe('function'));
    it('PSI_MAX_REQUESTS_PER_SECOND is exported', () => expect(typeof PSI_MAX_REQUESTS_PER_SECOND).toBe('number'));
});

// ─── runPsiAudit ─────────────────────────────────────────────────────────────

describe('runPsiAudit — pure function', () => {
    it('returns the API response JSON', async () => {
        mockFetchOk();
        const result = await runPsiAudit('https://example.com', 'fake-key');
        expect(result).toEqual(MOCK_API_DATA);
    });

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runPsiAudit('https://example.com', 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls fetch with the URL and API key', async () => {
        const fetchMock = mockFetchOk();
        await runPsiAudit('https://example.com', 'my-key');
        const calledUrl = fetchMock.mock.calls[0][0];
        expect(calledUrl).toContain('my-key');
        expect(calledUrl).toContain(encodeURIComponent('https://example.com'));
    });

    it('throws with status code on non-ok response', async () => {
        mockFetchError(403, 'Forbidden');
        await expect(runPsiAudit('https://example.com', 'fake-key'))
            .rejects.toThrow('403');
    });

    it('includes statusCode on the thrown error', async () => {
        mockFetchError(403, 'Forbidden');
        const err = await runPsiAudit('https://example.com', 'fake-key').catch((e) => e);
        expect(err.statusCode).toBe(403);
    });
});

// ─── runPsi ──────────────────────────────────────────────────────────────────

describe('runPsi — CLI wrapper', () => {
    it('is exported', () => expect(typeof runPsi).toBe('function'));

    it('calls fs.writeFileSync once with JSON data', async () => {
        mockFetchOk();
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        await runPsi('https://example.com', 'fake-key');
        expect(fsSpy).toHaveBeenCalledOnce();
        const written = JSON.parse(fsSpy.mock.calls[0][1]);
        expect(written).toEqual(MOCK_API_DATA);
    });

    it('returns the output file path', async () => {
        mockFetchOk();
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const path = await runPsi('https://example.com', 'fake-key');
        expect(typeof path).toBe('string');
        expect(path).toMatch(/psi.*example/);
    });
});

// ─── runPsi --clean ──────────────────────────────────────────────────────────

describe('runPsi — --clean flag', () => {
    it('writes only raw file when clean is not set', async () => {
        mockFetchOk();
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        await runPsi('https://example.com', 'fake-key');
        expect(fsSpy).toHaveBeenCalledOnce();
    });

    it('writes raw and clean files when clean: true', async () => {
        mockFetchOk();
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        await runPsi('https://example.com', 'fake-key', undefined, { clean: true });
        expect(fsSpy).toHaveBeenCalledTimes(2);
        const cleanCall = fsSpy.mock.calls.find((c) => c[0].includes('clean'));
        expect(cleanCall).toBeDefined();
        expect(cleanCall[0]).toMatch(/\.clean\.json$/);
        const written = JSON.parse(cleanCall[1]);
        expect(written._clean).toBe(true);
    });
});

// ─── runPsiAuditBatch ────────────────────────────────────────────────────────

describe('runPsiAuditBatch — pure batch', () => {
    it('is exported', () => expect(typeof runPsiAuditBatch).toBe('function'));

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runPsiAuditBatch(['https://example.com'], 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('returns array of { url, data, error }', async () => {
        mockFetchOk();
        const results = await runPsiAuditBatch(['https://a.com', 'https://b.com'], 'fake-key');
        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({ url: 'https://a.com', data: MOCK_API_DATA, error: null });
        expect(results[1]).toMatchObject({ url: 'https://b.com', data: MOCK_API_DATA, error: null });
    });

    it('captures errors per URL without throwing', async () => {
        mockFetchError(400, 'Bad request'); // 400 is not retryable — fast failure
        const results = await runPsiAuditBatch(['https://fail.com'], 'fake-key');
        expect(results[0].error).toBeTruthy();
        expect(results[0].data).toBeNull();
    });
});
