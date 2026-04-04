import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fs = require('fs');
const inquirer = require('inquirer');

const prompts = require('./prompts');

let promptSpy;
let readFileSyncSpy;
let existsSyncSpy;
let originalTTY;
let originalEnv;

beforeEach(() => {
    originalTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
    originalEnv = { ...process.env };
    delete process.env.WEB_PERF_PSI_API_KEY;
    delete process.env.WEB_PERF_PSI_API_KEY_PATH;
    promptSpy = vi.spyOn(inquirer, 'prompt');
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
});

afterEach(() => {
    process.stdin.isTTY = originalTTY;
    process.env = originalEnv;
    promptSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    existsSyncSpy.mockRestore();
});

describe('assertTTY (via prompt functions)', () => {
    it('should throw when not a TTY', async () => {
        process.stdin.isTTY = false;
        await expect(prompts.promptLinks()).rejects.toThrow('not a TTY');
    });
});

describe('normalizeUrls', () => {
    it('should strip query strings from URLs', () => {
        expect(prompts.normalizeUrls(['https://example.com/page?foo=bar'])).toEqual(['https://example.com/page']);
    });

    it('should strip hash fragments from URLs', () => {
        expect(prompts.normalizeUrls(['https://example.com/page#section'])).toEqual(['https://example.com/page']);
    });

    it('should strip both query and hash', () => {
        expect(prompts.normalizeUrls(['https://example.com/page?q=1#top'])).toEqual(['https://example.com/page']);
    });

    it('should remove duplicates after stripping', () => {
        expect(prompts.normalizeUrls([
            'https://example.com/page?a=1',
            'https://example.com/page?b=2',
        ])).toEqual(['https://example.com/page']);
    });

    it('should remove exact duplicates', () => {
        expect(prompts.normalizeUrls([
            'https://example.com/',
            'https://example.com/',
        ])).toEqual(['https://example.com/']);
    });

    it('should preserve order of first occurrence', () => {
        expect(prompts.normalizeUrls([
            'https://b.com/',
            'https://a.com/',
            'https://b.com/?x=1',
        ])).toEqual(['https://b.com/', 'https://a.com/']);
    });

    it('should leave clean URLs unchanged', () => {
        expect(prompts.normalizeUrls([
            'https://example.com/',
            'https://other.com/path',
        ])).toEqual(['https://example.com/', 'https://other.com/path']);
    });
});

describe('promptLinks', () => {
    it('should return url directly when provided', async () => {
        const result = await prompts.promptLinks('https://example.com');
        expect(result).toBe('https://example.com');
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should prompt for url when not provided', async () => {
        promptSpy.mockResolvedValueOnce({ url: 'https://prompted.com' });
        const result = await prompts.promptLinks();
        expect(result).toBe('https://prompted.com');
    });
});

describe('parseProfileFlag', () => {
    it('should return empty array for falsy input', () => {
        expect(prompts.parseProfileFlag(undefined)).toEqual([]);
        expect(prompts.parseProfileFlag('')).toEqual([]);
    });

    it('should expand "all" to all profile names', () => {
        expect(prompts.parseProfileFlag('all')).toEqual(['low', 'medium', 'high', 'native']);
    });

    it('should parse comma-separated profiles', () => {
        expect(prompts.parseProfileFlag('low,high')).toEqual(['low', 'high']);
    });

    it('should parse single profile', () => {
        expect(prompts.parseProfileFlag('low')).toEqual(['low']);
    });

    it('should throw on unknown profile', () => {
        expect(() => prompts.parseProfileFlag('invalid')).toThrow('Unknown profile: "invalid"');
    });

    it('should throw on unknown profile in comma list', () => {
        expect(() => prompts.parseProfileFlag('low,invalid')).toThrow('Unknown profile: "invalid"');
    });
});

describe('parseSkipAuditsFlag', () => {
    it('should return undefined for falsy input', () => {
        expect(prompts.parseSkipAuditsFlag(undefined)).toBeUndefined();
        expect(prompts.parseSkipAuditsFlag('')).toBeUndefined();
    });

    it('should parse a single audit', () => {
        expect(prompts.parseSkipAuditsFlag('full-page-screenshot')).toEqual(['full-page-screenshot']);
    });

    it('should parse comma-separated audits', () => {
        expect(prompts.parseSkipAuditsFlag('full-page-screenshot,network-requests')).toEqual(['full-page-screenshot', 'network-requests']);
    });

    it('should trim whitespace around audit names', () => {
        expect(prompts.parseSkipAuditsFlag(' full-page-screenshot , network-requests ')).toEqual(['full-page-screenshot', 'network-requests']);
    });

    it('should ignore empty segments from trailing commas', () => {
        expect(prompts.parseSkipAuditsFlag('full-page-screenshot,,network-requests,')).toEqual(['full-page-screenshot', 'network-requests']);
    });
});

describe('parseBlockedUrlPatternsFlag', () => {
    it('should return undefined for falsy input', () => {
        expect(prompts.parseBlockedUrlPatternsFlag(undefined)).toBeUndefined();
        expect(prompts.parseBlockedUrlPatternsFlag('')).toBeUndefined();
    });

    it('should parse a single pattern', () => {
        expect(prompts.parseBlockedUrlPatternsFlag('*.google-analytics.com')).toEqual(['*.google-analytics.com']);
    });

    it('should parse comma-separated patterns', () => {
        expect(prompts.parseBlockedUrlPatternsFlag('*.google-analytics.com,*.facebook.net')).toEqual(['*.google-analytics.com', '*.facebook.net']);
    });

    it('should trim whitespace around patterns', () => {
        expect(prompts.parseBlockedUrlPatternsFlag(' *.google-analytics.com , *.facebook.net ')).toEqual(['*.google-analytics.com', '*.facebook.net']);
    });

    it('should remove duplicate patterns', () => {
        expect(prompts.parseBlockedUrlPatternsFlag(' *.google-analytics.com , *.facebook.net , *.google-analytics.com ')).toEqual(['*.google-analytics.com', '*.facebook.net']);
    });

    it('should ignore empty segments from trailing commas', () => {
        expect(prompts.parseBlockedUrlPatternsFlag('*.google-analytics.com,,*.facebook.net,')).toEqual(['*.google-analytics.com', '*.facebook.net']);
    });
});

describe('promptLab', () => {
    const baseOpts = { profile: undefined, network: undefined, device: undefined, urls: undefined, urlsFile: undefined };

    it('should return runs array with single profile when provided via flag', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, profile: 'low' });
        expect(result).toEqual({
            urls: ['https://example.com/'],
            runs: [{ profile: 'low', network: undefined, device: undefined }],
        });
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should return multiple runs for comma-separated profiles', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, profile: 'low,high' });
        expect(result.runs).toEqual([
            { profile: 'low', network: undefined, device: undefined },
            { profile: 'high', network: undefined, device: undefined },
        ]);
    });

    it('should expand "all" to 4 runs', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, profile: 'all' });
        expect(result.runs).toHaveLength(4);
        expect(result.runs.map((r) => r.profile)).toEqual(['low', 'medium', 'high', 'native']);
    });

    it('should return custom run when only network/device flags provided', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, network: '3g', device: 'iphone-12' });
        expect(result.runs).toEqual([{ profile: undefined, network: '3g', device: 'iphone-12' }]);
    });

    it('should prompt for urls when missing', async () => {
        promptSpy.mockResolvedValueOnce({ urls: 'https://prompted.com' });
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: ['full-page-screenshot'] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab(undefined, baseOpts);
        expect(result.urls).toEqual(['https://prompted.com/']);
    });

    it('should prompt with checkbox for profiles when no flags given', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['high'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: ['full-page-screenshot'] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.runs).toEqual([{ profile: 'high', network: undefined, device: undefined }]);
    });

    it('should expand "all" selection in interactive mode', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['all'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.runs).toHaveLength(4);
        expect(result.runs.map((r) => r.profile)).toEqual(['low', 'medium', 'high', 'native']);
    });

    it('should prompt for network and device when custom is selected', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['custom'] });
        promptSpy.mockResolvedValueOnce({ network: '3g', device: 'iphone-12' });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.runs).toEqual([{ profile: undefined, network: '3g', device: 'iphone-12' }]);
    });

    it('should allow custom alongside named profiles', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['low', 'custom'] });
        promptSpy.mockResolvedValueOnce({ network: 'wifi', device: 'desktop' });
        promptSpy.mockResolvedValueOnce({ skipAudits: ['final-screenshot'] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.runs).toEqual([
            { profile: 'low', network: undefined, device: undefined },
            { profile: undefined, network: 'wifi', device: 'desktop' },
        ]);
    });

    it('should resolve multiple URLs from --urls flag', async () => {
        const result = await prompts.promptLab(undefined, { ...baseOpts, profile: 'low', urls: 'https://a.com, https://b.com, https://c.com' });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/', 'https://c.com/']);
        expect(result.runs).toHaveLength(1);
    });

    it('should resolve URLs from --urls-file flag', async () => {
        readFileSyncSpy.mockReturnValueOnce('https://a.com\nhttps://b.com\n\nhttps://c.com\n');
        const result = await prompts.promptLab(undefined, { ...baseOpts, profile: 'low', urlsFile: '/path/to/urls.txt' });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/', 'https://c.com/']);
        expect(readFileSyncSpy).toHaveBeenCalledWith('/path/to/urls.txt', 'utf-8');
    });

    it('should ignore positional url when --urls is provided', async () => {
        const result = await prompts.promptLab('https://ignored.com', { ...baseOpts, profile: 'low', urls: 'https://a.com,https://b.com' });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });

    it('should combine --urls and --urls-file', async () => {
        readFileSyncSpy.mockReturnValueOnce('https://c.com\nhttps://d.com\n');
        const result = await prompts.promptLab(undefined, { ...baseOpts, profile: 'low', urls: 'https://a.com,https://b.com', urlsFile: '/path/to/urls.txt' });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/']);
    });

    it('should prompt for comma-separated URLs when none provided interactively', async () => {
        promptSpy.mockResolvedValueOnce({ urls: 'https://a.com, https://b.com' });
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab(undefined, baseOpts);
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });

    it('should return empty skipAudits when nothing selected', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.skipAudits).toEqual([]);
    });

    it('should return selected skipAudits from interactive prompt', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: ['full-page-screenshot', 'network-requests'] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.skipAudits).toEqual(['full-page-screenshot', 'network-requests']);
    });

    it('should not prompt for skipAudits when --skip-audits flag is provided', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, profile: 'low', skipAudits: 'full-page-screenshot,final-screenshot' });
        expect(result.skipAudits).toBeUndefined();
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should return blockedUrlPatterns from interactive prompt', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '*.google-analytics.com, *.facebook.net' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.blockedUrlPatterns).toEqual(['*.google-analytics.com', '*.facebook.net']);
    });

    it('should not set blockedUrlPatterns when interactive input is blank', async () => {
        promptSpy.mockResolvedValueOnce({ profiles: ['low'] });
        promptSpy.mockResolvedValueOnce({ skipAudits: [] });
        promptSpy.mockResolvedValueOnce({ blockedUrlPatternsInput: '' });
        const result = await prompts.promptLab('https://example.com', baseOpts);
        expect(result.blockedUrlPatterns).toBeUndefined();
    });

    it('should not prompt for blockedUrlPatterns when --blocked-url-patterns flag is provided', async () => {
        const result = await prompts.promptLab('https://example.com', { ...baseOpts, profile: 'low', blockedUrlPatterns: '*.google-analytics.com' });
        expect(result.blockedUrlPatterns).toBeUndefined();
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should strip query strings and hashes from URLs', async () => {
        const result = await prompts.promptLab(undefined, {
            ...baseOpts,
            profile: 'low',
            urls: 'https://a.com/page?q=1#top,https://b.com/#hash',
        });
        expect(result.urls).toEqual(['https://a.com/page', 'https://b.com/']);
    });

    it('should deduplicate URLs that differ only by query/hash', async () => {
        const result = await prompts.promptLab(undefined, {
            ...baseOpts,
            profile: 'low',
            urls: 'https://a.com/page?q=1,https://a.com/page?q=2,https://b.com/',
        });
        expect(result.urls).toEqual(['https://a.com/page', 'https://b.com/']);
    });
});

describe('promptRum', () => {
    const baseOptions = { apiKey: null, apiKeyPath: null, urls: null, urlsFile: null, category: null, concurrency: undefined, delay: undefined };

    describe('API key resolution', () => {
        it('should use apiKey from options directly', async () => {
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'key-from-flag' });
            expect(result.apiKey).toBe('key-from-flag');
        });

        it('should read apiKey from apiKeyPath file', async () => {
            readFileSyncSpy.mockReturnValueOnce('  key-from-file  \n');
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKeyPath: '/path/to/key' });
            expect(result.apiKey).toBe('key-from-file');
            expect(readFileSyncSpy).toHaveBeenCalledWith('/path/to/key', 'utf-8');
        });

        it('should use WEB_PERF_PSI_API_KEY env var', async () => {
            process.env.WEB_PERF_PSI_API_KEY = 'key-from-env';
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions });
            expect(result.apiKey).toBe('key-from-env');
        });

        it('should read from WEB_PERF_PSI_API_KEY_PATH env var', async () => {
            process.env.WEB_PERF_PSI_API_KEY_PATH = '/env/path/key';
            readFileSyncSpy.mockReturnValueOnce('key-from-env-path\n');
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions });
            expect(result.apiKey).toBe('key-from-env-path');
        });

        it('should prompt for key when nothing else available', async () => {
            promptSpy.mockResolvedValueOnce({ apiKey: 'key-from-prompt' });
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions });
            expect(result.apiKey).toBe('key-from-prompt');
        });

        it('should prompt for file path when key prompt returns empty', async () => {
            promptSpy.mockResolvedValueOnce({ apiKey: '' });
            readFileSyncSpy.mockReturnValueOnce('key-from-prompted-file\n');
            promptSpy.mockResolvedValueOnce({ apiKeyPath: '/prompted/path' });
            promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions });
            expect(result.apiKey).toBe('key-from-prompted-file');
        });
    });

    describe('URL resolution', () => {
        it('should use positional url arg', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum('https://example.com', { ...baseOptions, apiKey: 'k' });
            expect(result.urls).toEqual(['https://example.com/']);
        });

        it('should parse --urls flag (comma-separated)', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: 'https://a.com,https://b.com' });
            expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
        });

        it('should read urls from file', async () => {
            readFileSyncSpy.mockReturnValueOnce('https://a.com\nhttps://b.com\n');
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urlsFile: '/urls.txt' });
            expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
        });

        it('should ignore positional url when --urls is provided', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum('https://ignored.com', { ...baseOptions, apiKey: 'k', urls: 'https://a.com' });
            expect(result.urls).toEqual(['https://a.com/']);
        });
    });

    describe('categories', () => {
        it('should parse --category flag', async () => {
            const result = await prompts.promptRum('https://example.com', { ...baseOptions, apiKey: 'k', category: 'performance,seo' });
            expect(result.categories).toEqual(['PERFORMANCE', 'SEO']);
        });
    });

    describe('concurrency and delay', () => {
        const fiveUrls = 'https://a.com,https://b.com,https://c.com,https://d.com,https://e.com';

        it('should prompt for concurrency and delay when URLs >= default concurrency', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            promptSpy.mockResolvedValueOnce({ concurrency: '3' });
            promptSpy.mockResolvedValueOnce({ delay: '100' });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: fiveUrls });
            expect(result.concurrency).toBe(3);
            expect(result.delay).toBe(100);
        });

        it('should use defaults when prompts are empty', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            promptSpy.mockResolvedValueOnce({ concurrency: '' });
            promptSpy.mockResolvedValueOnce({ delay: '' });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: fiveUrls });
            expect(result.concurrency).toBe(5);
            expect(result.delay).toBe(0);
        });

        it('should not prompt concurrency/delay for single URL', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum('https://example.com', { ...baseOptions, apiKey: 'k' });
            expect(result.concurrency).toBeUndefined();
            expect(result.delay).toBeUndefined();
        });

        it('should not prompt concurrency/delay when URLs < default concurrency', async () => {
            promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
            const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: 'https://a.com,https://b.com' });
            expect(result.concurrency).toBeUndefined();
            expect(result.delay).toBeUndefined();
        });
    });

    it('should strip query strings and hashes from URLs', async () => {
        promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
        const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: 'https://a.com/page?q=1#top' });
        expect(result.urls).toEqual(['https://a.com/page']);
    });

    it('should deduplicate URLs that differ only by query/hash', async () => {
        promptSpy.mockResolvedValueOnce({ categories: ['PERFORMANCE'] });
        const result = await prompts.promptRum(undefined, { ...baseOptions, apiKey: 'k', urls: 'https://a.com/?x=1,https://a.com/?y=2' });
        expect(result.urls).toEqual(['https://a.com/']);
    });
});

describe('promptCollect', () => {
    it('should resolve scope and API key from options', async () => {
        const result = await prompts.promptCollect('https://example.com', { scope: 'origin', apiKey: 'test-key' });
        expect(result.scope).toBe('origin');
        expect(result.apiKey).toBe('test-key');
        expect(result.urls).toEqual(['https://example.com/']);
    });

    it('should resolve API key from WEB_PERF_PSI_API_KEY env', async () => {
        process.env.WEB_PERF_PSI_API_KEY = 'env-key';
        const result = await prompts.promptCollect('https://example.com', { scope: 'page' });
        expect(result.apiKey).toBe('env-key');
    });

    it('should resolve API key from apiKeyPath option', async () => {
        readFileSyncSpy.mockReturnValueOnce('file-key\n');
        const result = await prompts.promptCollect('https://example.com/page', { scope: 'page', apiKeyPath: '/key.txt' });
        expect(result.apiKey).toBe('file-key');
    });

    it('should parse --urls option', async () => {
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com,https://b.com',
            concurrency: 5,
            delay: 0,
        });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });

    it('should read --urls-file option', async () => {
        readFileSyncSpy.mockImplementation((path, _enc) => {
            if (path === '/urls.txt') {
                return 'https://a.com\nhttps://b.com\n';
            }
            return 'file-key';
        });
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urlsFile: '/urls.txt',
            concurrency: 5,
            delay: 0,
        });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });

    it('should prompt for scope when not provided', async () => {
        promptSpy.mockResolvedValueOnce({ scope: 'origin' });
        promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
        promptSpy.mockResolvedValueOnce({ apiKey: 'prompted-key' });
        const result = await prompts.promptCollect(undefined, {});
        expect(result.scope).toBe('origin');
        expect(result.apiKey).toBe('prompted-key');
    });

    it('should prompt for API key when nothing available', async () => {
        promptSpy.mockResolvedValueOnce({ urls: 'https://example.com' });
        promptSpy.mockResolvedValueOnce({ apiKey: 'prompted-key' });
        const result = await prompts.promptCollect(undefined, { scope: 'page' });
        expect(result.apiKey).toBe('prompted-key');
    });

    it('should prompt for concurrency and delay when URLs >= default concurrency', async () => {
        promptSpy.mockResolvedValueOnce({ concurrency: '3' });
        promptSpy.mockResolvedValueOnce({ delay: '100' });
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com,https://b.com,https://c.com,https://d.com,https://e.com',
        });
        expect(result.concurrency).toBe(3);
        expect(result.delay).toBe(100);
    });

    it('should not prompt concurrency/delay for single URL', async () => {
        const result = await prompts.promptCollect('https://example.com', { scope: 'origin', apiKey: 'k' });
        expect(result.concurrency).toBeUndefined();
        expect(result.delay).toBeUndefined();
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should not prompt concurrency/delay when URLs < default concurrency', async () => {
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com,https://b.com',
        });
        expect(result.concurrency).toBeUndefined();
        expect(result.delay).toBeUndefined();
    });

    it('should strip query strings and hashes from URLs', async () => {
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com/page?q=1#top',
        });
        expect(result.urls).toEqual(['https://a.com/page']);
    });

    it('should deduplicate URLs that differ only by query/hash', async () => {
        const result = await prompts.promptCollect(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com/?x=1,https://a.com/?y=2,https://b.com/',
        });
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });
});

describe('promptCollectHistory', () => {
    it('should delegate to promptCollect with scope and API key', async () => {
        const result = await prompts.promptCollectHistory('https://example.com', { scope: 'origin', apiKey: 'test-key' });
        expect(result.scope).toBe('origin');
        expect(result.apiKey).toBe('test-key');
        expect(result.urls).toEqual(['https://example.com/']);
    });

    it('should support page scope with multiple URLs', async () => {
        const result = await prompts.promptCollectHistory(undefined, {
            scope: 'page',
            apiKey: 'k',
            urls: 'https://a.com,https://b.com',
            concurrency: 5,
            delay: 0,
        });
        expect(result.scope).toBe('page');
        expect(result.urls).toEqual(['https://a.com/', 'https://b.com/']);
    });
});

describe('promptSitemap', () => {
    it('should return resolved options when all provided', async () => {
        const result = await prompts.promptSitemap('https://example.com', { depth: 5, sitemapUrl: 'https://example.com/sitemap.xml', delay: 100 });
        expect(result).toEqual({ url: 'https://example.com', depth: 5, sitemapUrl: 'https://example.com/sitemap.xml', delay: 100 });
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('should prompt for missing options with defaults', async () => {
        promptSpy.mockResolvedValueOnce({ depth: '' });
        promptSpy.mockResolvedValueOnce({ sitemapUrl: '' });
        promptSpy.mockResolvedValueOnce({ delay: '' });
        const result = await prompts.promptSitemap('https://example.com', { depth: undefined, sitemapUrl: undefined, delay: undefined });
        expect(result.depth).toBe(3);
        expect(result.sitemapUrl).toBeUndefined();
        expect(result.delay).toBeUndefined();
    });
});

describe('validateUrl', () => {
    it('should return true for valid URL', () => {
        expect(prompts.validateUrl('https://example.com')).toBe(true);
    });

    it('should return error string for invalid URL', () => {
        expect(prompts.validateUrl('not-a-url')).toBe('Please enter a valid URL (e.g. https://example.com)');
    });

    it('should accept URL with path and query', () => {
        expect(prompts.validateUrl('https://example.com/page?q=1')).toBe(true);
    });
});

describe('validatePositiveInt', () => {
    it('should return true for empty input', () => {
        expect(prompts.validatePositiveInt('')).toBe(true);
        expect(prompts.validatePositiveInt('  ')).toBe(true);
    });

    it('should return true for valid positive integer', () => {
        expect(prompts.validatePositiveInt('5')).toBe(true);
        expect(prompts.validatePositiveInt('1')).toBe(true);
    });

    it('should return error for zero', () => {
        expect(prompts.validatePositiveInt('0')).toBe('Enter a positive number');
    });

    it('should return error for negative number', () => {
        expect(prompts.validatePositiveInt('-1')).toBe('Enter a positive number');
    });

    it('should return error for non-numeric input', () => {
        expect(prompts.validatePositiveInt('abc')).toBe('Enter a positive number');
    });
});

describe('validateNonNegativeInt', () => {
    it('should return true for empty input', () => {
        expect(prompts.validateNonNegativeInt('')).toBe(true);
        expect(prompts.validateNonNegativeInt('  ')).toBe(true);
    });

    it('should return true for zero', () => {
        expect(prompts.validateNonNegativeInt('0')).toBe(true);
    });

    it('should return true for positive integer', () => {
        expect(prompts.validateNonNegativeInt('100')).toBe(true);
    });

    it('should return error for negative number', () => {
        expect(prompts.validateNonNegativeInt('-1')).toBe('Enter a number in milliseconds');
    });

    it('should return error for non-numeric input', () => {
        expect(prompts.validateNonNegativeInt('abc')).toBe('Enter a number in milliseconds');
    });
});

describe('validateFilePath', () => {
    it('should return error message for empty input', () => {
        expect(prompts.validateFilePath('')).toBe('Path is required');
        expect(prompts.validateFilePath('  ')).toBe('Path is required');
    });

    it('should use custom required message', () => {
        expect(prompts.validateFilePath('', 'API key or file path is required')).toBe('API key or file path is required');
    });

    it('should return error when file does not exist', () => {
        existsSyncSpy.mockReturnValue(false);
        expect(prompts.validateFilePath('/no/such/file')).toBe('File not found: /no/such/file');
    });

    it('should return true when file exists', () => {
        existsSyncSpy.mockReturnValue(true);
        expect(prompts.validateFilePath('/exists/file.json')).toBe(true);
    });
});

describe('resolveRumApiKey', () => {
    it('should return apiKey from options', () => {
        expect(prompts.resolveRumApiKey({ apiKey: 'direct-key' })).toBe('direct-key');
    });

    it('should read from apiKeyPath', () => {
        readFileSyncSpy.mockReturnValue('  file-key  \n');
        expect(prompts.resolveRumApiKey({ apiKeyPath: '/key.txt' })).toBe('file-key');
        expect(readFileSyncSpy).toHaveBeenCalledWith('/key.txt', 'utf-8');
    });

    it('should use WEB_PERF_PSI_API_KEY env var', () => {
        process.env.WEB_PERF_PSI_API_KEY = 'env-key';
        expect(prompts.resolveRumApiKey({})).toBe('env-key');
    });

    it('should read from WEB_PERF_PSI_API_KEY_PATH env var', () => {
        process.env.WEB_PERF_PSI_API_KEY_PATH = '/env/key.txt';
        readFileSyncSpy.mockReturnValue('env-file-key\n');
        expect(prompts.resolveRumApiKey({})).toBe('env-file-key');
    });

    it('should return null when nothing available', () => {
        expect(prompts.resolveRumApiKey({})).toBeNull();
    });

    it('should respect priority: options.apiKey wins over env', () => {
        process.env.WEB_PERF_PSI_API_KEY = 'env-key';
        expect(prompts.resolveRumApiKey({ apiKey: 'flag-key' })).toBe('flag-key');
    });
});

describe('resolveCruxApiKey', () => {
    it('should return apiKey from options', () => {
        expect(prompts.resolveCruxApiKey({ apiKey: 'direct-key' })).toBe('direct-key');
    });

    it('should read from apiKeyPath', () => {
        readFileSyncSpy.mockReturnValue('  file-key  \n');
        expect(prompts.resolveCruxApiKey({ apiKeyPath: '/key.txt' })).toBe('file-key');
        expect(readFileSyncSpy).toHaveBeenCalledWith('/key.txt', 'utf-8');
    });

    it('should use WEB_PERF_PSI_API_KEY env var', () => {
        process.env.WEB_PERF_PSI_API_KEY = 'env-key';
        expect(prompts.resolveCruxApiKey({})).toBe('env-key');
    });

    it('should read from WEB_PERF_PSI_API_KEY_PATH env var', () => {
        process.env.WEB_PERF_PSI_API_KEY_PATH = '/env/key.txt';
        readFileSyncSpy.mockReturnValue('env-file-key\n');
        expect(prompts.resolveCruxApiKey({})).toBe('env-file-key');
    });

    it('should return null when nothing available', () => {
        expect(prompts.resolveCruxApiKey({})).toBeNull();
    });

    it('should respect priority: options.apiKey wins over env', () => {
        process.env.WEB_PERF_PSI_API_KEY = 'env-key';
        expect(prompts.resolveCruxApiKey({ apiKey: 'flag-key' })).toBe('flag-key');
    });
});
