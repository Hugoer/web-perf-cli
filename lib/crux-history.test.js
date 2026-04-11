import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';

const {
    runCruxHistory,
    runCruxHistoryBatch,
    runCruxHistoryAudit,
    runCruxHistoryAuditBatch,
    CRUX_HISTORY_MAX_REQUESTS_PER_SECOND,
} = require('./crux-history');

const MOCK_HISTORY_RESPONSE = {
    record: {
        collectionPeriods: [{ firstDate: {}, lastDate: {} }],
        metrics: { largest_contentful_paint: { histogramTimeseries: [] } },
        key: { origin: 'https://example.com' },
    },
};

const mockFetchOk = () => {
    const stub = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_HISTORY_RESPONSE),
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

describe('exports', () => {
    it('runCruxHistory is exported', () => expect(typeof runCruxHistory).toBe('function'));
    it('runCruxHistoryBatch is exported', () => expect(typeof runCruxHistoryBatch).toBe('function'));
    it('runCruxHistoryAudit is exported', () => expect(typeof runCruxHistoryAudit).toBe('function'));
    it('runCruxHistoryAuditBatch is exported', () => expect(typeof runCruxHistoryAuditBatch).toBe('function'));
    it('CRUX_HISTORY_MAX_REQUESTS_PER_SECOND is exported', () => expect(typeof CRUX_HISTORY_MAX_REQUESTS_PER_SECOND).toBe('number'));
});

// ─── runCruxHistoryAudit ──────────────────────────────────────────────────────

describe('runCruxHistoryAudit — pure function', () => {
    it('returns structured output with source, scope, collectionPeriods, metrics', async () => {
        mockFetchOk();
        const result = await runCruxHistoryAudit('https://example.com', 'fake-key');
        expect(result.source).toBe('crux-api');
        expect(result.collectionPeriods).toEqual(MOCK_HISTORY_RESPONSE.record.collectionPeriods);
        expect(result.metrics).toBeDefined();
    });

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runCruxHistoryAudit('https://example.com', 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('throws with statusCode on non-ok response', async () => {
        mockFetchError(403, 'Forbidden');
        const err = await runCruxHistoryAudit('https://example.com', 'fake-key').catch((e) => e);
        expect(err.statusCode).toBe(403);
    });

    it('throws a friendly message for 404', async () => {
        mockFetchError(404, 'Not found');
        await expect(runCruxHistoryAudit('https://example.com', 'fake-key'))
            .rejects.toThrow('No CrUX history data found');
    });
});

// ─── runCruxHistory ───────────────────────────────────────────────────────────

describe('runCruxHistory — CLI wrapper', () => {
    it('is exported', () => expect(typeof runCruxHistory).toBe('function'));

    it('calls fs.writeFileSync once', async () => {
        mockFetchOk();
        const fsSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        await runCruxHistory('https://example.com', 'fake-key');
        expect(fsSpy).toHaveBeenCalledOnce();
    });

    it('returns the output file path', async () => {
        mockFetchOk();
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        const path = await runCruxHistory('https://example.com', 'fake-key');
        expect(typeof path).toBe('string');
        expect(path).toMatch(/crux-history.*example/);
    });
});

// ─── runCruxHistoryAuditBatch ─────────────────────────────────────────────────

describe('runCruxHistoryAuditBatch — pure batch', () => {
    it('is exported', () => expect(typeof runCruxHistoryAuditBatch).toBe('function'));

    it('does not call fs.writeFileSync', async () => {
        mockFetchOk();
        const spy = vi.spyOn(fs, 'writeFileSync');
        await runCruxHistoryAuditBatch(['https://example.com'], 'fake-key');
        expect(spy).not.toHaveBeenCalled();
    });

    it('returns array of { url, data, error }', async () => {
        mockFetchOk();
        const results = await runCruxHistoryAuditBatch(['https://a.com', 'https://b.com'], 'fake-key');
        expect(results).toHaveLength(2);
        expect(results[0].data).toMatchObject({ source: 'crux-api' });
        expect(results[0].error).toBeNull();
    });

    it('captures errors per URL without throwing', async () => {
        mockFetchError(400, 'Bad request');
        const results = await runCruxHistoryAuditBatch(['https://fail.com'], 'fake-key');
        expect(results[0].error).toBeTruthy();
        expect(results[0].data).toBeNull();
    });
});
