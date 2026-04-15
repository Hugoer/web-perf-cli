const lazy = (loader) => {
    let cached;
    return () => {
        if (cached === undefined) {
            cached = loader();
        }
        return cached;
    };
};

const lab = lazy(() => require('./lab'));
const psi = lazy(() => require('./psi'));
const crux = lazy(() => require('./crux'));
const cruxHistory = lazy(() => require('./crux-history'));
const utils = lazy(() => require('./utils'));

module.exports = {
    // Pure audit functions — return data, no file I/O (server-safe)
    /** @returns {typeof import('./lab').runLabAudit} */
    get runLabAudit() {
        return lab().runLabAudit;
    },
    /** @returns {typeof import('./psi').runPsiAudit} */
    get runPsiAudit() {
        return psi().runPsiAudit;
    },
    /** @returns {typeof import('./crux').runCruxAudit} */
    get runCruxAudit() {
        return crux().runCruxAudit;
    },
    /** @returns {typeof import('./crux-history').runCruxHistoryAudit} */
    get runCruxHistoryAudit() {
        return cruxHistory().runCruxHistoryAudit;
    },
    /** @returns {typeof import('./psi').runPsiAuditBatch} */
    get runPsiAuditBatch() {
        return psi().runPsiAuditBatch;
    },
    /** @returns {typeof import('./crux').runCruxAuditBatch} */
    get runCruxAuditBatch() {
        return crux().runCruxAuditBatch;
    },
    /** @returns {typeof import('./crux-history').runCruxHistoryAuditBatch} */
    get runCruxHistoryAuditBatch() {
        return cruxHistory().runCruxHistoryAuditBatch;
    },
    // CLI wrappers — write to disk, return file path (CLI use only)
    /** @returns {typeof import('./lab').runLab} */
    get runLab() {
        return lab().runLab;
    },
    /** @returns {typeof import('./psi').runPsi} */
    get runPsi() {
        return psi().runPsi;
    },
    /** @returns {typeof import('./crux').runCrux} */
    get runCrux() {
        return crux().runCrux;
    },
    /** @returns {typeof import('./crux-history').runCruxHistory} */
    get runCruxHistory() {
        return cruxHistory().runCruxHistory;
    },
    /** @returns {typeof import('./psi').runPsiBatch} */
    get runPsiBatch() {
        return psi().runPsiBatch;
    },
    /** @returns {typeof import('./crux').runCruxBatch} */
    get runCruxBatch() {
        return crux().runCruxBatch;
    },
    /** @returns {typeof import('./crux-history').runCruxHistoryBatch} */
    get runCruxHistoryBatch() {
        return cruxHistory().runCruxHistoryBatch;
    },
    // Shared constants and utilities
    /** @returns {typeof import('./lab').buildLighthouseConfig} */
    get buildLighthouseConfig() {
        return lab().buildLighthouseConfig;
    },
    /** @returns {typeof import('./lab').CHROME_FLAGS} */
    get CHROME_FLAGS() {
        return lab().CHROME_FLAGS;
    },
    /** @returns {typeof import('./lab').DEFAULT_SKIP_AUDITS} */
    get DEFAULT_SKIP_AUDITS() {
        return lab().DEFAULT_SKIP_AUDITS;
    },
    /** @returns {typeof import('./utils').sleep} */
    get sleep() {
        return utils().sleep;
    },
    /** @returns {typeof import('./utils').createRateLimiter} */
    get createRateLimiter() {
        return utils().createRateLimiter;
    },
    /** @returns {typeof import('./utils').normalizeOrigin} */
    get normalizeOrigin() {
        return utils().normalizeOrigin;
    },
};
