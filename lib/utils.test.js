import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const path = require('path');

const { formatDate, buildFilename, formatElapsed, RESULTS_DIR } = require('./utils');

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
