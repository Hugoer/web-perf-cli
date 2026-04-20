const ROOT_KEYS_TO_DROP = [
    'i18n', 'timing', 'configSettings', 'categoryGroups',
    'stackPacks', 'entities', 'gatherMode', 'userAgent',
    'environment', 'fullPageScreenshot',
];

const PSI_KEYS_TO_DROP = ['captchaResult', 'kind', 'analysisUTCTimestamp'];

function shouldKeepAudit(audit) {
    const mode = audit.scoreDisplayMode;
    if (mode === 'notApplicable' || mode === 'manual') {
        return false;
    }
    if (audit.score === null || audit.score < 1) {
        return true;
    }
    if (mode === 'metricSavings') {
        return true;
    }
    if (mode === 'numeric' && audit.numericValue > 0) {
        return true;
    }
    return false;
}

function cleanLabReport(report) {
    if (report && report._clean === true) {
        return report;
    }
    if (!report || typeof report !== 'object') {
        return report;
    }
    const result = { _clean: true };
    for (const [key, value] of Object.entries(report)) {
        if (!ROOT_KEYS_TO_DROP.includes(key) && key !== 'audits') {
            result[key] = value;
        }
    }
    if (report.audits) {
        result.audits = {};
        for (const [id, audit] of Object.entries(report.audits)) {
            if (shouldKeepAudit(audit)) {
                // eslint-disable-next-line no-unused-vars
                const { description, ...rest } = audit;
                result.audits[id] = rest;
            }
        }
    }
    return result;
}

function cleanPsiReport(report) {
    if (!report || typeof report !== 'object') {
        return report;
    }
    const result = { _clean: true };
    for (const [key, value] of Object.entries(report)) {
        if (!PSI_KEYS_TO_DROP.includes(key)) {
            if (key === 'lighthouseResult') {
                result.lighthouseResult = cleanLabReport(value);
            } else {
                result[key] = value;
            }
        }
    }
    return result;
}

function detectReportType(basename) {
    if (basename.startsWith('lab-')) {
        return 'lab';
    }
    if (basename.startsWith('psi-')) {
        return 'psi';
    }
    return null;
}

module.exports = { cleanLabReport, cleanPsiReport, detectReportType, shouldKeepAudit };
