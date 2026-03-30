const fs = require('fs');
const { BigQuery } = require('@google-cloud/bigquery');
const { ensureCommandDir, buildFilename } = require('./utils');

async function findLatestTable(bigquery) {
    const query = `
    SELECT table_name
    FROM \`chrome-ux-report.materialized.INFORMATION_SCHEMA.TABLES\`
    WHERE table_name LIKE 'device_summary'
    ORDER BY table_name DESC
    LIMIT 1
  `;

    const [rows] = await bigquery.query({ query });

    if (!rows.length) {
        throw new Error('No tables found in chrome-ux-report.materialized');
    }

    return rows[0].table_name;
}

async function findLatestDateInTable(bigquery, tableName) {
    const query = `
    SELECT CAST(MAX(yyyymmdd) AS STRING) AS latest_date
    FROM \`chrome-ux-report.materialized.${tableName}\`
  `;

    const [rows] = await bigquery.query({ query });

    if (!rows.length || !rows[0].latest_date) {
        throw new Error(`No data found in table ${tableName}`);
    }

    return rows[0].latest_date;
}

function defaultSinceDate() {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function runCollectHistory(domain, authOptions, since) {
    ensureCommandDir('collect-history');

    const bigquery = new BigQuery(authOptions);

    console.log('Searching for latest CrUX materialized table...');
    const tableName = await findLatestTable(bigquery);
    console.log(`Found table: ${tableName}`);

    console.log('Finding latest date with data...');
    const latestDate = await findLatestDateInTable(bigquery, tableName);
    console.log(`Latest data date: ${latestDate}`);

    const startDate = since ? since.replace(/-/g, '') : defaultSinceDate();
    const origin = (domain.startsWith('http') ? domain : `https://${domain}`).replace(/\/+$/, '');

    const query = `
    SELECT
      origin,
      device,
      rank,
      yyyymmdd AS date,

      -- LCP
      p75_lcp,
      fast_lcp,
      avg_lcp,
      slow_lcp,

      -- CLS
      p75_cls,
      small_cls,
      medium_cls,
      large_cls,

      -- INP
      p75_inp,
      fast_inp,
      avg_inp,
      slow_inp,

      -- TTFB
      p75_ttfb,
      fast_ttfb,
      avg_ttfb,
      slow_ttfb,

      -- FCP
      p75_fcp,
      fast_fcp,
      avg_fcp,
      slow_fcp,

      -- Effective connection type
      _4GDensity,
      _3GDensity,
      _2GDensity,
      slow2GDensity,
      offlineDensity

    FROM \`chrome-ux-report.materialized.${tableName}\`
    WHERE
      origin = @origin
      AND yyyymmdd >= @startDate
      AND yyyymmdd <= @endDate
    ORDER BY yyyymmdd, device, rank
  `;

    console.log(`Querying historical CrUX data for: ${origin} (from ${startDate} to ${latestDate})`);
    const [rows] = await bigquery.query({
        query,
        params: { origin, startDate, endDate: latestDate },
    });

    if (!rows.length) {
        throw new Error(`No CrUX data found for origin "${origin}" between ${startDate} and ${latestDate}`);
    }

    console.log(`Found ${rows.length} row(s)`);

    const output = {
        origin,
        table: tableName,
        dateRange: { from: startDate, to: latestDate },
        extractedAt: new Date().toISOString(),
        rowCount: rows.length,
        data: rows,
    };

    const outputPath = buildFilename(origin, 'collect-history');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    return outputPath;
}

module.exports = { runCollectHistory };
