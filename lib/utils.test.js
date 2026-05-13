import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const path = require('path');

const {
    formatDate,
    buildFilename,
    formatElapsed,
    normalizeUrlForAi,
    writeAiOutput,
    createRateLimiter,
    withRetry,
    runBatch,
    RESULTS_DIR,
} = require('./utils');

let mockDateValue;
let RealDate;

beforeEach(() => {
    RealDate = Date;
    global.Date = class extends RealDate {
        constructor() {
            super();
            // eslint-disable-next-line no-constructor-return
            return new RealDate(mockDateValue);
        }
    };
});

afterEach(() => {
    global.Date = RealDate;
});

describe('utils', () => {
    describe('createRateLimiter', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it('should enforce spacing between request starts', async () => {
            vi.useFakeTimers();

            const limiter = createRateLimiter({ maxRequestsPerSecond: 4 }); // 250ms spacing
            const timestamps = [];

            const tasks = Array.from({ length: 3 }, async () => {
                await limiter();
                timestamps.push(Date.now());
            });

            await vi.runAllTimersAsync();
            await Promise.all(tasks);

            expect(timestamps).toHaveLength(3);
            expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(250);
            expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(250);
        });

        it('should throw for non-positive rate values', () => {
            expect(() => createRateLimiter({ maxRequestsPerSecond: 0 })).toThrow(
                'maxRequestsPerSecond must be a positive number'
            );
            expect(() => createRateLimiter({ maxRequestsPerSecond: -1 })).toThrow(
                'maxRequestsPerSecond must be a positive number'
            );
        });
    });

    describe('formatDate', () => {
        it('should return a string in YYYY-MM-DD-HHMMSS format', () => {
            mockDateValue = '2026-04-01T12:34:56Z';
            expect(formatDate()).toBe('2026-04-01-123456');
        });

        it('should pad single-digit months, days, hours, minutes, seconds with zeros', () => {
            mockDateValue = '2026-01-02T03:04:05Z';
            expect(formatDate()).toBe('2026-01-02-030405');
        });

        it('should work for end of year', () => {
            mockDateValue = '2025-12-31T23:59:59Z';
            expect(formatDate()).toBe('2025-12-31-235959');
        });

        it('should always use UTC, not local time', () => {
            mockDateValue = '2026-04-01T01:02:03Z';
            expect(formatDate()).toBe('2026-04-01-010203');
        });
    });

    describe('buildFilename', () => {
        let existsSyncSpy;

        beforeEach(() => {
            mockDateValue = '2026-04-01T12:34:56Z';
            existsSyncSpy = vi.spyOn(fs, 'existsSync');
        });

        afterEach(() => {
            existsSyncSpy.mockRestore();
        });

        it('should return a .json file path under results/<command>/', () => {
            existsSyncSpy.mockReturnValue(false);
            const result = buildFilename('https://example.com', 'lab');
            expect(result).toBe(path.join(RESULTS_DIR, 'lab', 'lab-example.com-2026-04-01-123456.json'));
        });

        it('should use the hostname from the URL', () => {
            existsSyncSpy.mockReturnValue(false);
            const result = buildFilename('https://my-site.org/page?q=1', 'rum');
            expect(result).toContain('rum-my-site.org-');
        });

        it('should include the command prefix in the filename', () => {
            existsSyncSpy.mockReturnValue(false);
            const result = buildFilename('https://example.com', 'collect');
            const filename = path.basename(result);
            expect(filename).toMatch(/^collect-/);
        });

        it('should append _01 suffix when base filename already exists', () => {
            existsSyncSpy.mockImplementation((p) => p.endsWith('lab-example.com-2026-04-01-123456.json'));
            const result = buildFilename('https://example.com', 'lab');
            expect(result).toBe(path.join(RESULTS_DIR, 'lab', 'lab-example.com-2026-04-01-123456_01.json'));
        });

        it('should increment suffix when multiple collisions exist', () => {
            const base = path.join(RESULTS_DIR, 'lab', 'lab-example.com-2026-04-01-123456');
            existsSyncSpy.mockImplementation((p) => p === `${base}.json` || p === `${base}_01.json` || p === `${base}_02.json`);
            const result = buildFilename('https://example.com', 'lab');
            expect(result).toBe(`${base}_03.json`);
        });

        it('should pad the suffix with leading zero for single-digit numbers', () => {
            existsSyncSpy.mockImplementation((p) => p.endsWith('lab-example.com-2026-04-01-123456.json'));
            const result = buildFilename('https://example.com', 'lab');
            expect(path.basename(result)).toMatch(/_01\.json$/);
        });

        it('should throw on invalid URL', () => {
            existsSyncSpy.mockReturnValue(false);
            expect(() => buildFilename('not-a-url', 'lab')).toThrow();
        });
    });

    describe('buildFilename with custom ext', () => {
        let existsSyncSpy;

        beforeEach(() => {
            mockDateValue = '2026-04-01T12:34:56Z';
            existsSyncSpy = vi.spyOn(fs, 'existsSync');
        });

        afterEach(() => {
            existsSyncSpy.mockRestore();
        });

        it('should return a .txt file path when ext is txt', () => {
            existsSyncSpy.mockReturnValue(false);
            const result = buildFilename('https://example.com', 'sitemap', undefined, 'txt');
            expect(result).toBe(path.join(RESULTS_DIR, 'sitemap', 'sitemap-example.com-2026-04-01-123456.txt'));
        });

        it('should handle collision with .txt extension', () => {
            existsSyncSpy.mockImplementation((p) => p.endsWith('sitemap-example.com-2026-04-01-123456.txt'));
            const result = buildFilename('https://example.com', 'sitemap', undefined, 'txt');
            expect(result).toBe(path.join(RESULTS_DIR, 'sitemap', 'sitemap-example.com-2026-04-01-123456_01.txt'));
        });
    });

    describe('normalizeUrlForAi', () => {
        it('should strip query string', () => {
            expect(normalizeUrlForAi('https://example.com/page?q=1')).toBe('https://example.com/page');
        });

        it('should strip hash fragment', () => {
            expect(normalizeUrlForAi('https://example.com/page#section')).toBe('https://example.com/page');
        });

        it('should strip both query and hash', () => {
            expect(normalizeUrlForAi('https://example.com/page?q=1#top')).toBe('https://example.com/page');
        });

        it('should return clean URL unchanged', () => {
            expect(normalizeUrlForAi('https://example.com/page')).toBe('https://example.com/page');
        });
    });

    describe('writeAiOutput', () => {
        let writeFileSyncSpy;
        let existsSyncSpy;
        let mkdirSyncSpy;

        beforeEach(() => {
            mockDateValue = '2026-04-01T12:34:56Z';
            writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
            existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        });

        afterEach(() => {
            writeFileSyncSpy.mockRestore();
            existsSyncSpy.mockRestore();
            mkdirSyncSpy.mockRestore();
        });

        it('should normalize and deduplicate URLs', () => {
            existsSyncSpy.mockImplementation((p) => {
                if (p.endsWith('.txt')) {
                    return false;
                }
                return true;
            });
            const urls = ['https://a.com/p?q=1', 'https://a.com/p#h', 'https://a.com/other'];
            writeAiOutput(urls, 'https://a.com', 'sitemap');
            expect(writeFileSyncSpy).toHaveBeenCalledWith(
                expect.stringContaining('.txt'),
                'https://a.com/p\nhttps://a.com/other'
            );
        });

        it('should return a .txt file path', () => {
            existsSyncSpy.mockImplementation((p) => {
                if (p.endsWith('.txt')) {
                    return false;
                }
                return true;
            });
            const result = writeAiOutput(['https://a.com/page'], 'https://a.com', 'sitemap');
            expect(result).toMatch(/\.txt$/);
        });
    });

    describe('formatElapsed', () => {
        it('should return seconds only when under 1 minute', () => {
            expect(formatElapsed(5000)).toBe('5s');
        });

        it('should return minutes and seconds when 1 minute or more', () => {
            expect(formatElapsed(90000)).toBe('1m 30s');
        });

        it('should return 0s for zero milliseconds', () => {
            expect(formatElapsed(0)).toBe('0s');
        });

        it('should round seconds to nearest integer', () => {
            expect(formatElapsed(1500)).toBe('2s');
            expect(formatElapsed(1400)).toBe('1s');
        });

        it('should handle exact minute boundaries', () => {
            expect(formatElapsed(60000)).toBe('1m 0s');
            expect(formatElapsed(120000)).toBe('2m 0s');
        });

        it('should handle large values', () => {
            expect(formatElapsed(605000)).toBe('10m 5s');
        });
    });
});

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

    it('accepts object items via urlOf and passes the full item to callbacks', async () => {
        const items = [
            { url: 'https://a.com', strategy: 'mobile' },
            { url: 'https://a.com', strategy: 'desktop' },
        ];
        const auditFn = vi.fn((item) => Promise.resolve({ url: item.url, strategy: item.strategy }));
        const writeFn = vi.fn((item) => `/results/${new URL(item.url).hostname}-${item.strategy}.json`);
        const progress = [];
        const results = await runBatch(items, auditFn, {
            maxRequestsPerSecond: HIGH_RPS,
            writeFn,
            urlOf: (i) => i.url,
            onProgress: (c, t, u, e) => progress.push({ c, t, u, e }),
        });
        expect(auditFn).toHaveBeenCalledTimes(2);
        expect(writeFn).toHaveBeenCalledTimes(2);
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.url === 'https://a.com')).toBe(true);
        expect(results.map((r) => r.item.strategy).sort()).toEqual(['desktop', 'mobile']);
        expect(results.find((r) => r.item.strategy === 'mobile').outputPath).toBe('/results/a.com-mobile.json');
        expect(progress.every((p) => p.u === 'https://a.com')).toBe(true);
    });
});
