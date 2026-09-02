import { describe, it, expect, vi, afterEach } from 'vitest';

const {
    extractUrls, decodeXmlEntities, isSitemapIndex, randomizeDelay, resolveSitemapUrl,
} = require('./sitemap');

describe('extractUrls', () => {
    it('should extract URLs from XML', () => {
        const xml = '<urlset><url><loc>https://a.com/</loc></url><url><loc>https://b.com/</loc></url></urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/', 'https://b.com/']);
    });

    it('should return an empty array when no <loc> tags exist', () => {
        const xml = '<urlset></urlset>';
        expect(extractUrls(xml)).toEqual([]);
    });

    it('should trim whitespace inside <loc> tags', () => {
        const xml = '<urlset><url><loc>  https://a.com/  </loc></url></urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/']);
    });

    it('should extract URLs from a sitemap index (child sitemap locations)', () => {
        const xml = '<sitemapindex><sitemap><loc>https://a.com/sitemap-1.xml</loc></sitemap></sitemapindex>';
        expect(extractUrls(xml)).toEqual(['https://a.com/sitemap-1.xml']);
    });

    it('should handle multiline XML', () => {
        const xml = `<urlset>
            <url>
                <loc>https://a.com/page1</loc>
            </url>
            <url>
                <loc>https://a.com/page2</loc>
            </url>
        </urlset>`;
        expect(extractUrls(xml)).toEqual(['https://a.com/page1', 'https://a.com/page2']);
    });
});

describe('extractUrls — XML entity decoding', () => {
    // The sitemaps protocol requires `&` to be escaped inside <loc>, so an undecoded
    // extraction corrupts every URL carrying a query string.
    it('decodes an escaped ampersand in a query string', () => {
        const xml = '<urlset><url><loc>https://a.com/p?x=1&amp;y=2</loc></url></urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/p?x=1&y=2']);
    });

    it('decodes multiple escaped ampersands in one URL', () => {
        const xml = '<urlset><url><loc>https://a.com/p?a=1&amp;b=2&amp;c=3</loc></url></urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/p?a=1&b=2&c=3']);
    });

    it('decodes entities across several <loc> tags', () => {
        const xml = '<urlset>'
            + '<url><loc>https://a.com/x?u=1&amp;v=2</loc></url>'
            + '<url><loc>https://a.com/y</loc></url>'
            + '</urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/x?u=1&v=2', 'https://a.com/y']);
    });

    it('leaves a URL with no entities untouched', () => {
        const xml = '<urlset><url><loc>https://a.com/plain</loc></url></urlset>';
        expect(extractUrls(xml)).toEqual(['https://a.com/plain']);
    });
});

describe('decodeXmlEntities', () => {
    it('decodes the five predefined entities', () => {
        expect(decodeXmlEntities('&amp;')).toBe('&');
        expect(decodeXmlEntities('&lt;')).toBe('<');
        expect(decodeXmlEntities('&gt;')).toBe('>');
        expect(decodeXmlEntities('&quot;')).toBe('"');
        expect(decodeXmlEntities('&apos;')).toBe("'");
    });

    it('decodes decimal character references', () => {
        expect(decodeXmlEntities('caf&#233;')).toBe('café');
    });

    it('decodes hexadecimal character references', () => {
        expect(decodeXmlEntities('caf&#xE9;')).toBe('café');
        expect(decodeXmlEntities('caf&#XE9;')).toBe('café');
    });

    it('decodes astral-plane character references', () => {
        expect(decodeXmlEntities('&#128512;')).toBe('\u{1F600}');
    });

    // A single pass, so an escaped entity survives as literal text instead of being
    // decoded a second time.
    it('does not double-decode an escaped entity', () => {
        expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
        expect(decodeXmlEntities('&amp;amp;')).toBe('&amp;');
    });

    it('leaves unknown named entities as written', () => {
        expect(decodeXmlEntities('a&nbsp;b')).toBe('a&nbsp;b');
    });

    it('leaves out-of-range character references as written', () => {
        expect(decodeXmlEntities('&#1114112;')).toBe('&#1114112;');
        expect(decodeXmlEntities('&#x110000;')).toBe('&#x110000;');
    });

    it('leaves a bare ampersand alone', () => {
        expect(decodeXmlEntities('a & b')).toBe('a & b');
    });

    it('returns an empty string unchanged', () => {
        expect(decodeXmlEntities('')).toBe('');
    });
});

describe('isSitemapIndex', () => {
    it('should return true for sitemap index XML', () => {
        const xml = '<sitemapindex></sitemapindex>';
        expect(isSitemapIndex(xml)).toBe(true);
    });

    it('should return true when sitemapindex has attributes', () => {
        const xml = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>';
        expect(isSitemapIndex(xml)).toBe(true);
    });

    it('should return false for normal sitemap XML', () => {
        const xml = '<urlset></urlset>';
        expect(isSitemapIndex(xml)).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isSitemapIndex('')).toBe(false);
    });
});

describe('randomizeDelay', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return a value within expected range', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const delay = randomizeDelay(1000);
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1500);
    });

    it('should apply minimum jitter when Math.random returns 0', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(randomizeDelay(1000)).toBe(950);
    });

    it('should apply maximum jitter when Math.random returns 1', () => {
        vi.spyOn(Math, 'random').mockReturnValue(1);
        expect(randomizeDelay(1000)).toBe(1051);
    });

    it('should never return less than 1', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(randomizeDelay(0)).toBe(1);
    });
});

describe('resolveSitemapUrl', () => {
    it('should append /sitemap.xml for a plain domain', () => {
        expect(resolveSitemapUrl('example.com')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap.xml',
        });
    });

    it('should append /sitemap.xml for a domain with https', () => {
        expect(resolveSitemapUrl('https://example.com')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap.xml',
        });
    });

    it('should strip trailing slash before appending', () => {
        expect(resolveSitemapUrl('https://example.com/')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap.xml',
        });
    });

    it('should use .xml URL directly as sitemap URL', () => {
        expect(resolveSitemapUrl('https://example.com/sitemaps/main.xml')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemaps/main.xml',
        });
    });

    it('should handle .xml.gz URLs', () => {
        expect(resolveSitemapUrl('https://example.com/sitemap.xml.gz')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap.xml.gz',
        });
    });

    it('should add https for bare domain with .xml path', () => {
        expect(resolveSitemapUrl('example.com/sitemap-pages.xml')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap-pages.xml',
        });
    });

    it('should handle http URLs', () => {
        expect(resolveSitemapUrl('http://example.com')).toEqual({
            origin: 'http://example.com',
            sitemapUrl: 'http://example.com/sitemap.xml',
        });
    });
});

describe('resolveSitemapUrl — origin is always an origin', () => {
    it('strips a path from the reported origin but keeps it in the sitemap URL', () => {
        expect(resolveSitemapUrl('https://example.com/es')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/es/sitemap.xml',
        });
    });

    it('handles a nested path', () => {
        expect(resolveSitemapUrl('https://example.com/a/b')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/a/b/sitemap.xml',
        });
    });

    it('leaves a bare domain unchanged', () => {
        expect(resolveSitemapUrl('example.com')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/sitemap.xml',
        });
    });

    it('leaves an explicit .xml input unchanged', () => {
        expect(resolveSitemapUrl('https://example.com/es/custom.xml')).toEqual({
            origin: 'https://example.com',
            sitemapUrl: 'https://example.com/es/custom.xml',
        });
    });
});
