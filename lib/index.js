const lazy = (loader) => {
    let cached;
    return () => (cached ??= loader());
};

const lab = lazy(() => require('./lab'));
const psi = lazy(() => require('./psi'));
const crux = lazy(() => require('./crux'));
const cruxHistory = lazy(() => require('./crux-history'));
const utils = lazy(() => require('./utils'));

module.exports = {
    // Pure audit functions — return data, no file I/O (server-safe)
    get runLabAudit() { return lab().runLabAudit; },
    get runPsiAudit() { return psi().runPsiAudit; },
    get runCruxAudit() { return crux().runCruxAudit; },
    get runCruxHistoryAudit() { return cruxHistory().runCruxHistoryAudit; },
    get runPsiAuditBatch() { return psi().runPsiAuditBatch; },
    get runCruxAuditBatch() { return crux().runCruxAuditBatch; },
    get runCruxHistoryAuditBatch() { return cruxHistory().runCruxHistoryAuditBatch; },
    // CLI wrappers — write to disk, return file path (CLI use only)
    get runLab() { return lab().runLab; },
    get runPsi() { return psi().runPsi; },
    get runCrux() { return crux().runCrux; },
    get runCruxHistory() { return cruxHistory().runCruxHistory; },
    get runPsiBatch() { return psi().runPsiBatch; },
    get runCruxBatch() { return crux().runCruxBatch; },
    get runCruxHistoryBatch() { return cruxHistory().runCruxHistoryBatch; },
    // Shared constants and utilities
    get buildLighthouseConfig() { return lab().buildLighthouseConfig; },
    get CHROME_FLAGS() { return lab().CHROME_FLAGS; },
    get DEFAULT_SKIP_AUDITS() { return lab().DEFAULT_SKIP_AUDITS; },
    get sleep() { return utils().sleep; },
    get createRateLimiter() { return utils().createRateLimiter; },
    get normalizeOrigin() { return utils().normalizeOrigin; },
};
