/**
 * @typedef {Object} LighthouseAudit
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {number|null} score
 * @property {string} scoreDisplayMode
 * @property {string} [displayValue]
 * @property {number} [numericValue]
 * @property {string} [numericUnit]
 * @property {unknown} [details]
 */

/**
 * @typedef {Object} LighthouseCategory
 * @property {string} id
 * @property {string} title
 * @property {number|null} score
 * @property {{ id: string, weight: number, group?: string }[]} auditRefs
 */

/**
 * @typedef {Object} LabReport
 * @property {string} lighthouseVersion
 * @property {string} requestedUrl
 * @property {string} finalUrl
 * @property {string} fetchTime
 * @property {'desktop'|'mobile'} formFactor
 * @property {Record<string, LighthouseCategory>} categories
 * @property {Record<string, LighthouseAudit>} audits
 * @property {boolean} [_clean]
 */

/**
 * @typedef {Object} PsiReport
 * @property {LabReport} lighthouseResult
 * @property {unknown} [loadingExperience]
 * @property {unknown} [originLoadingExperience]
 * @property {boolean} [_clean]
 */

const ROOT_KEYS_TO_DROP = [
    'i18n', 'timing', 'configSettings', 'categoryGroups',
    'stackPacks', 'entities', 'gatherMode', 'userAgent',
    'environment', 'fullPageScreenshot',
];

const PSI_KEYS_TO_DROP = ['captchaResult', 'kind', 'analysisUTCTimestamp'];

/**
 * @param {LighthouseAudit} audit
 * @returns {boolean}
 */
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

/**
 * @param {LabReport} report
 * @returns {LabReport & { _clean: true }}
 */
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

/**
 * @param {PsiReport} report
 * @returns {PsiReport & { _clean: true }}
 */
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

/**
 * @param {string} basename
 * @returns {'lab' | 'psi' | null}
 */
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
