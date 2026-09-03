import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';

const { createCruxClient, CRUX_MAX_REQUESTS_PER_SECOND } = require('./crux-client');

const RECORD = {
    collectionPeriod: { firstDate: { year: 2026 } },
    collectionPeriods: [{ firstDate: { year: 2026 } }],
    metrics: { largest_contentful_paint: { percentiles: { p75: 2500 } } },
    key: { origin: 'https://example.com' },
};

/** Captures the request so the configured endpoint and body can be asserted. */
const mockFetchOk = () => {
    const stub = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ record: RECORD }) });
    vi.stubGlobal('fetch', stub);
    return stub;
};

const mockFetchError = (status, body = 'err') => {
    const stub = vi.fn().mockResolvedValue({ ok: false, status, text: () => Promise.resolve(body) });
    vi.stubGlobal('fetch', stub);
    return stub;
};

const silentFs = () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
};

const client = (overrides = {}) => createCruxClient({
    endpoint: 'https://api.test/v1/records:queryThing',
    command: 'thing',
    dataLabel: 'Thing',
    periodKey: 'collectionPeriod',
    ...overrides,
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('createCruxClient — configuration is actually used', () => {
    it('posts to the configured endpoint', async () => {
        const stub = mockFetchOk();
        await client().runAudit('https://example.com', 'KEY');
        expect(stub.mock.calls[0][0]).toContain('https://api.test/v1/records:queryThing');
    });

    it('sends the api key as an encoded query parameter', async () => {
        const stub = mockFetchOk();
        await client().runAudit('https://example.com', 'k/e y');
        expect(stub.mock.calls[0][0]).toContain(`key=${encodeURIComponent('k/e y')}`);
    });

    // The periodKey is a computed property, so a wrong value fails silently: the record
    // simply carries `undefined` under a key nobody reads.
    it('reads the record field named by periodKey', async () => {
        mockFetchOk();
        const single = await client({ periodKey: 'collectionPeriod' }).runAudit('https://example.com', 'KEY');
        expect(single.collectionPeriod).toEqual(RECORD.collectionPeriod);
        expect(single).not.toHaveProperty('collectionPeriods');
    });

    it('supports a plural periodKey for the history endpoint', async () => {
        mockFetchOk();
        const many = await client({ periodKey: 'collectionPeriods' }).runAudit('https://example.com', 'KEY');
        expect(many.collectionPeriods).toEqual(RECORD.collectionPeriods);
        expect(many).not.toHaveProperty('collectionPeriod');
    });

    it('keeps the written key order stable', async () => {
        mockFetchOk();
        const report = await client().runAudit('https://example.com', 'KEY', { formFactor: 'phone' });
        expect(Object.keys(report)).toEqual([
            'source', 'scope', 'formFactor', 'url', 'collectionPeriod', 'extractedAt', 'metrics', 'key',
        ]);
    });

    it('uses dataLabel in the no-data message', async () => {
        mockFetchError(404);
        await expect(client().runAudit('https://example.com', 'KEY'))
            .rejects.toThrow('No Thing data found');
    });

    it('uses dataLabel in the generic API error message', async () => {
        mockFetchError(403, 'Forbidden');
        await expect(client().runAudit('https://example.com', 'KEY'))
            .rejects.toThrow('Thing API error (403)');
    });

    it('writes into the directory named by command', async () => {
        mockFetchOk();
        silentFs();
        const [outputPath] = await client().run('https://example.com', 'KEY', { formFactors: ['phone'] });
        expect(outputPath).toContain(`${require('path').sep}thing${require('path').sep}`);
        expect(require('path').basename(outputPath)).toMatch(/^thing-example\.com-/);
    });

    it('writes batch output into the same configured directory', async () => {
        mockFetchOk();
        silentFs();
        const results = await client().runWriteBatch(['https://example.com'], 'KEY', { formFactors: ['phone'] });
        expect(results[0].outputPath).toContain(`${require('path').sep}thing${require('path').sep}`);
    });

    it('defaults the request rate to the shared CrUX cap', async () => {
        mockFetchOk();
        expect(CRUX_MAX_REQUESTS_PER_SECOND).toBe(2.5);
        const results = await client().runAuditBatch(['https://example.com'], 'KEY', { formFactors: ['phone'] });
        expect(results).toHaveLength(1);
    });

    it('honours an overridden request rate', async () => {
        mockFetchOk();
        const started = Date.now();
        // Two requests at 5/s means the second waits ~200ms behind the first.
        await client({ maxRequestsPerSecond: 5 }).runAuditBatch(
            ['https://a.example', 'https://b.example'],
            'KEY',
            { formFactors: ['phone'], concurrency: 2 },
        );
        expect(Date.now() - started).toBeGreaterThanOrEqual(150);
    });

    it('reports a 404 as noData rather than an error', async () => {
        mockFetchError(404);
        const results = await client().runAuditBatch(['https://example.com'], 'KEY', { formFactors: ['phone'] });
        expect(results[0]).toMatchObject({ noData: true, error: null, data: null });
    });

    it('reports a non-404 as an error with noData false', async () => {
        mockFetchError(403, 'Forbidden');
        const results = await client().runAuditBatch(['https://example.com'], 'KEY', { formFactors: ['phone'] });
        expect(results[0].noData).toBe(false);
        expect(results[0].error).toMatch(/403/);
    });
});

// The factory is only correct if the two modules in front of it are wired correctly. Swapping
// any of these four values between crux.js and crux-history.js would leave every other test
// in the suite passing while writing the wrong record into the wrong directory.
describe('crux and crux-history are wired to different endpoints', () => {
    it('crux queries queryRecord and returns a single collectionPeriod', async () => {
        const stub = mockFetchOk();
        const { runCruxAudit } = require('./crux');
        const report = await runCruxAudit('https://example.com', 'KEY');
        expect(stub.mock.calls[0][0]).toContain('records:queryRecord?');
        expect(report).toHaveProperty('collectionPeriod');
        expect(report).not.toHaveProperty('collectionPeriods');
    });

    it('crux-history queries queryHistoryRecord and returns collectionPeriods', async () => {
        const stub = mockFetchOk();
        const { runCruxHistoryAudit } = require('./crux-history');
        const report = await runCruxHistoryAudit('https://example.com', 'KEY');
        expect(stub.mock.calls[0][0]).toContain('records:queryHistoryRecord?');
        expect(report).toHaveProperty('collectionPeriods');
        expect(report).not.toHaveProperty('collectionPeriod');
    });

    it('each writes into its own results directory', async () => {
        mockFetchOk();
        silentFs();
        const { sep } = require('path');
        const { runCrux } = require('./crux');
        const { runCruxHistory } = require('./crux-history');
        const [cruxPath] = await runCrux('https://example.com', 'KEY', { formFactors: ['phone'] });
        const [historyPath] = await runCruxHistory('https://example.com', 'KEY', { formFactors: ['phone'] });
        expect(cruxPath).toContain(`${sep}crux${sep}`);
        expect(historyPath).toContain(`${sep}crux-history${sep}`);
    });

    it('each labels its own no-data message', async () => {
        mockFetchError(404);
        const { runCruxAudit } = require('./crux');
        const { runCruxHistoryAudit } = require('./crux-history');
        await expect(runCruxAudit('https://example.com', 'KEY')).rejects.toThrow('No CrUX data found');
        await expect(runCruxHistoryAudit('https://example.com', 'KEY')).rejects.toThrow('No CrUX history data found');
    });
});

describe('exported form-factor constants are immutable', () => {
    const crux = require('./crux');
    const cruxHistory = require('./crux-history');

    it('freezes both constants', () => {
        expect(Object.isFrozen(crux.CRUX_FORM_FACTORS)).toBe(true);
        expect(Object.isFrozen(crux.DEFAULT_CRUX_FORM_FACTORS)).toBe(true);
    });

    // They are deliberately one instance shared by both subpaths, which is exactly why a
    // consumer mutating one would have changed the default for the other.
    it('shares one instance across crux and crux-history', () => {
        expect(crux.DEFAULT_CRUX_FORM_FACTORS).toBe(cruxHistory.DEFAULT_CRUX_FORM_FACTORS);
        expect(crux.CRUX_FORM_FACTORS).toBe(cruxHistory.CRUX_FORM_FACTORS);
    });

    it('rejects a push that would add a form factor to every later call', () => {
        expect(() => crux.DEFAULT_CRUX_FORM_FACTORS.push('tablet')).toThrow(TypeError);
        expect(crux.DEFAULT_CRUX_FORM_FACTORS).toEqual(['phone', 'desktop']);
    });

    it('still allows callers to extend a copy', () => {
        expect([...crux.DEFAULT_CRUX_FORM_FACTORS, 'tablet']).toEqual(['phone', 'desktop', 'tablet']);
    });
});
