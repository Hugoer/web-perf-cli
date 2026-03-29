const fs = require('fs');
const fetch = require('node-fetch');
const { ensureModeDir, buildFilename } = require('./utils');

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function runRum(url, apiKey, categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']) {
    ensureModeDir('rum');
    const categoryParams = categories.map((c) => `category=${c}`).join('&');
    const apiUrl = `${PSI_API_URL}?url=${encodeURIComponent(url)}&${categoryParams}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`PageSpeed Insights API error (${response.status}): ${body}`);
    }

    const data = await response.json();
    const outputPath = buildFilename(url, 'rum');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    return outputPath;
}

module.exports = { runRum };
