const fs = require('fs');
const fetch = require('node-fetch');
const { ensureModeDir, buildFilename } = require('./utils');

function extractUrls(xml) {
  const urls = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function isSitemapIndex(xml) {
  return xml.includes('<sitemapindex');
}

async function fetchSitemap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
}

async function parseSitemaps(sitemapUrl, maxDepth = 3) {
  if (maxDepth <= 0) return [];

  console.log(`Fetching: ${sitemapUrl}`);
  const xml = await fetchSitemap(sitemapUrl);

  if (isSitemapIndex(xml)) {
    const childSitemaps = extractUrls(xml);
    console.log(`Found sitemap index with ${childSitemaps.length} child sitemap(s)`);

    const allUrls = [];
    for (const childUrl of childSitemaps) {
      const urls = await parseSitemaps(childUrl, maxDepth - 1);
      allUrls.push(...urls);
    }
    return allUrls;
  }

  const urls = extractUrls(xml);
  console.log(`Found ${urls.length} URL(s) in ${sitemapUrl}`);
  return urls;
}

async function runSitemap(domain, maxDepth = 3, customSitemapUrl) {
  ensureModeDir('sitemap');

  const origin = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain.replace(/\/$/, '')}`;
  const sitemapUrl = customSitemapUrl || `${origin}/sitemap.xml`;

  console.log(`Extracting URLs from sitemap for: ${origin} (max depth: ${maxDepth})`);
  const urls = await parseSitemaps(sitemapUrl, maxDepth);

  if (!urls.length) {
    throw new Error(`No URLs found in sitemap at ${sitemapUrl}`);
  }

  const output = {
    origin,
    sitemapUrl,
    extractedAt: new Date().toISOString(),
    urlCount: urls.length,
    urls,
  };

  const outputPath = buildFilename(origin, 'sitemap');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  return outputPath;
}

module.exports = { runSitemap };
