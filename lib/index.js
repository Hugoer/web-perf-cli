const { runCruxAudit, runCrux, runCruxAuditBatch, runCruxBatch } = require('./crux');
const { runCruxHistoryAudit, runCruxHistory, runCruxHistoryAuditBatch, runCruxHistoryBatch } = require('./crux-history');
const { runLabAudit, runLab, buildLighthouseConfig, CHROME_FLAGS, DEFAULT_SKIP_AUDITS } = require('./lab');
const { runPsiAudit, runPsi, runPsiAuditBatch, runPsiBatch } = require('./psi');
const { sleep, createRateLimiter, normalizeOrigin } = require('./utils');

module.exports = {
    // Pure audit functions — return data, no file I/O (server-safe)
    runLabAudit,
    runPsiAudit,
    runCruxAudit,
    runCruxHistoryAudit,
    runPsiAuditBatch,
    runCruxAuditBatch,
    runCruxHistoryAuditBatch,
    // CLI wrappers — write to disk, return file path (CLI use only)
    runLab,
    runPsi,
    runCrux,
    runCruxHistory,
    runPsiBatch,
    runCruxBatch,
    runCruxHistoryBatch,
    // Shared constants and utilities
    buildLighthouseConfig,
    CHROME_FLAGS,
    DEFAULT_SKIP_AUDITS,
    sleep,
    createRateLimiter,
    normalizeOrigin,
};
