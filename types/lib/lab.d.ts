export type LighthouseAudit = {
    id: string;
    title: string;
    description: string;
    score: number | null;
    scoreDisplayMode: string;
    displayValue?: string;
    numericValue?: number;
    numericUnit?: string;
    details?: unknown;
};
export type LighthouseCategory = {
    id: string;
    title: string;
    description: string;
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
    timing: {
        total: number;
        breakdown: Record<string, number>;
    };
    categories: Record<string, LighthouseCategory>;
    audits: Record<string, LighthouseAudit>;
};
export function runLab(url: any, labOptions?: {}): Promise<string>;
/**
 * @param {string} url
 * @param {{ port?: number, profile?: string, network?: string, device?: string, skipAudits?: string[], blockedUrlPatterns?: string[], stripJsonProps?: boolean, silent?: boolean }} [labOptions]
 * @returns {Promise<LabReport>}
 */
export function runLabAudit(url: string, labOptions?: {
    port?: number;
    profile?: string;
    network?: string;
    device?: string;
    skipAudits?: string[];
    blockedUrlPatterns?: string[];
    stripJsonProps?: boolean;
    silent?: boolean;
}): Promise<LabReport>;
/**
 * @typedef {{ id: string, title: string, description: string, score: number|null, scoreDisplayMode: string, displayValue?: string, numericValue?: number, numericUnit?: string, details?: unknown }} LighthouseAudit
 * @typedef {{ id: string, title: string, description: string, score: number|null, auditRefs: { id: string, weight: number, group?: string }[] }} LighthouseCategory
 */
/**
 * @typedef {Object} LabReport
 * @property {string} lighthouseVersion
 * @property {string} requestedUrl
 * @property {string} finalUrl
 * @property {string} fetchTime
 * @property {'desktop'|'mobile'} formFactor
 * @property {{ total: number, breakdown: Record<string, number> }} timing
 * @property {Record<string, LighthouseCategory>} categories
 * @property {Record<string, LighthouseAudit>} audits
 */
export function buildLighthouseConfig(labOptions: any, profileSettings?: {}): {
    extends: string;
    settings: any;
} | undefined;
export const CHROME_FLAGS: string[];
export const DEFAULT_SKIP_AUDITS: string[];
