export type LighthouseAudit = {
    id: string;
    title: string;
    description?: string | undefined;
    score: number | null;
    scoreDisplayMode: string;
    displayValue?: string | undefined;
    numericValue?: number | undefined;
    numericUnit?: string | undefined;
    details?: unknown;
};
export type LighthouseCategory = {
    id: string;
    title: string;
    score: number | null;
    auditRefs: {
        id: string;
        weight: number;
        group?: string;
    }[];
};
export type LabReport = {
    lighthouseVersion: string;
    requestedUrl: string;
    finalUrl: string;
    fetchTime: string;
    formFactor: "desktop" | "mobile";
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
    _clean?: boolean | undefined;
};
export type PsiReport = {
    lighthouseResult: LabReport;
    loadingExperience?: unknown;
    originLoadingExperience?: unknown;
    _clean?: boolean | undefined;
};
/**
 * @param {LabReport} report
 * @returns {LabReport & { _clean: true }}
 */
export function cleanLabReport(report: LabReport): LabReport & {
    _clean: true;
};
/**
 * @param {PsiReport} report
 * @returns {PsiReport & { _clean: true }}
 */
export function cleanPsiReport(report: PsiReport): PsiReport & {
    _clean: true;
};
/**
 * @param {string} basename
 * @returns {'lab' | 'psi' | null}
 */
export function detectReportType(basename: string): "lab" | "psi" | null;
/**
 * @param {LighthouseAudit} audit
 * @returns {boolean}
 */
export function shouldKeepAudit(audit: LighthouseAudit): boolean;
