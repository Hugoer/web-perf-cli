import { describe, it, expect, vi } from 'vitest';

const { withRetry, runBatch } = require('../lib/utils');

// ─── withRetry ───────────────────────────────────────────────────────────────

describe('withRetry', () => {
    const noSleep = () => Promise.resolve();

    it('returns result on first try', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withRetry(fn, { _sleep: noSleep });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries once on 429 and returns result', async () => {
        const err = Object.assign(new Error('rate limit'), { statusCode: 429 });
        const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue('ok');
        const result = await withRetry(fn, { maxRetries: 2, _sleep: noSleep });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 5xx errors', async () => {
        const err = Object.assign(new Error('server error'), { statusCode: 503 });
        const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue('ok');
        const result = await withRetry(fn, { maxRetries: 2, _sleep: noSleep });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-429 4xx errors', async () => {
        const err = Object.assign(new Error('not found'), { statusCode: 404 });
        const fn = vi.fn().mockRejectedValue(err);
        await expect(withRetry(fn, { maxRetries: 2, _sleep: noSleep })).rejects.toThrow('not found');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws after maxRetries exhausted', async () => {
        const err = Object.assign(new Error('server error'), { statusCode: 500 });
        const fn = vi.fn().mockRejectedValue(err);
        await expect(withRetry(fn, { maxRetries: 2, _sleep: noSleep })).rejects.toThrow('server error');
        expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    });

    it('doubles the backoff delay on each retry attempt', async () => {
        const err = Object.assign(new Error('server error'), { statusCode: 500 });
        const fn = vi.fn().mockRejectedValue(err);
        const delays = [];
        const recordSleep = (ms) => {
            delays.push(ms); return Promise.resolve(); 
        };
        await withRetry(fn, { maxRetries: 2, baseDelayMs: 1000, _sleep: recordSleep }).catch(() => {});
        expect(delays).toEqual([1000, 2000]);
    });
});

// ─── runBatch ────────────────────────────────────────────────────────────────

describe('runBatch', () => {
    const HIGH_RPS = 1000; // effectively no rate limit in tests

    it('processes all URLs and returns results', async () => {
        const auditFn = vi.fn((url) => Promise.resolve({ data: url }));
        const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
        const results = await runBatch(urls, auditFn, { maxRequestsPerSecond: HIGH_RPS });
        expect(results).toHaveLength(3);
        expect(auditFn).toHaveBeenCalledTimes(3);
        expect(results.every((r) => r.error === null)).toBe(true);
    });

    it('captures per-URL errors without aborting the batch', async () => {
        const auditFn = vi.fn((url) => {
            if (url === 'https://bad.com') {
                return Promise.reject(new Error('fetch failed'));
            }
            return Promise.resolve({ data: url });
        });
        const urls = ['https://ok.com', 'https://bad.com', 'https://ok2.com'];
        const results = await runBatch(urls, auditFn, { maxRequestsPerSecond: HIGH_RPS });
        expect(results).toHaveLength(3);
        const bad = results.find((r) => r.url === 'https://bad.com');
        expect(bad.error).toBe('fetch failed');
        const good = results.filter((r) => r.url !== 'https://bad.com');
        expect(good.every((r) => r.error === null)).toBe(true);
    });

    it('calls onProgress for each URL', async () => {
        const auditFn = vi.fn((url) => Promise.resolve({ data: url }));
        const urls = ['https://a.com', 'https://b.com'];
        const progress = [];
        const onProgress = (completed, total, url, error) => progress.push({ completed, total, url, error });
        await runBatch(urls, auditFn, { maxRequestsPerSecond: HIGH_RPS, onProgress });
        expect(progress).toHaveLength(2);
        expect(progress[0].total).toBe(2);
        expect(progress.map((p) => p.url).sort()).toEqual(urls.sort());
    });

    it('respects the concurrency limit', async () => {
        let concurrent = 0;
        let maxConcurrent = 0;
        const auditFn = async () => {
            concurrent++;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise((r) => {
                setTimeout(r, 10); 
            });
            concurrent--;
            return {};
        };
        const urls = Array.from({ length: 10 }, (_, i) => `https://url${i}.com`);
        await runBatch(urls, auditFn, { maxRequestsPerSecond: HIGH_RPS, concurrency: 3 });
        expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('calls writeFn and includes outputPath in result when provided', async () => {
        const auditFn = vi.fn((url) => Promise.resolve({ data: url }));
        const writeFn = vi.fn((url, _data) => `/results/${new URL(url).hostname}.json`);
        const urls = ['https://a.com', 'https://b.com'];
        const results = await runBatch(urls, auditFn, { maxRequestsPerSecond: HIGH_RPS, writeFn });
        expect(writeFn).toHaveBeenCalledTimes(2);
        expect(results.every((r) => r.outputPath !== null)).toBe(true);
        expect(results.find((r) => r.url === 'https://a.com').outputPath).toBe('/results/a.com.json');
    });

    it('returns empty array for empty URL list', async () => {
        const auditFn = vi.fn();
        const results = await runBatch([], auditFn, { maxRequestsPerSecond: HIGH_RPS });
        expect(results).toHaveLength(0);
        expect(auditFn).not.toHaveBeenCalled();
    });
});
