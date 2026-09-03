// Type-level regression tests for the PUBLISHED declarations in types/.
//
// `npm test` runs the implementation; nothing checked that the .d.ts files describe it. Three
// gaps shipped that way: LabPlanOptions rejected every option the CLI passes, LabReport
// omitted environment/runtimeError/configSettings, and onSummary's argument was typed `object`.
//
// This file imports the package by name, so it resolves through package.json "exports" exactly
// as a consumer's would. It is type-checked only — never executed, never published.
// Run with: npm run check-types

import { runLabPlan, runLabAudit } from '@hugoer/web-perf-cli/lab';
import { runCruxAudit, runCruxBatch, DEFAULT_CRUX_FORM_FACTORS } from '@hugoer/web-perf-cli/crux';
import { runCruxHistoryAudit } from '@hugoer/web-perf-cli/crux-history';
import { buildRunSummary } from '@hugoer/web-perf-cli/variance';
import type { LabReport, LabPlanResult } from '@hugoer/web-perf-cli/lab';
import type { CruxReport } from '@hugoer/web-perf-cli/crux';
import type { CruxHistoryReport } from '@hugoer/web-perf-cli/crux-history';

// --- runLabPlan accepts every option bin/web-perf.js passes -------------------------------
export const plan: Promise<LabPlanResult[]> = runLabPlan(
    ['https://example.com'],
    [{ profile: 'low' }],
    {
        skipAudits: ['uses-http2'],
        blockedUrlPatterns: ['*.example-ads.com'],
        categories: ['performance'],
        stripJsonProps: true,
        clean: true,
        silent: false,
        continueOnError: true,
        reuseBrowser: false,
        repeats: 3,
    },
    {
        onRunStart: ({ url, runIndex, totalRuns }) => `${url}${runIndex}${totalRuns}`,
        onRunComplete: ({ outputPath, report }) => `${outputPath}${report.finalUrl}`,
        onRunError: ({ error }) => error,
        // onSummary must expose RunSummary, not a bare object: the CLI dereferences this.
        onSummary: ({ summary }) => summary.stability.warnings.map((w: string) => w),
    },
);

// --- LabReport declares what survives stripJsonProps ---------------------------------------
export function readsReport(r: LabReport) {
    const bench: number | undefined = r.environment?.benchmarkIndex;
    const failed: string | undefined = r.runtimeError?.code;
    const ff = r.configSettings?.formFactor;
    // timing is optional: stripJsonProps removes it by default
    const total: number | undefined = r.timing?.total;
    return [bench, failed, ff, total, r.categories, r.audits];
}

// --- variance consumes reports collected by any means --------------------------------------
export const summary = buildRunSummary(
    [{ report: {} as LabReport, outputPath: 'a.json' }],
    { url: 'https://example.com', profile: 'low' },
);
export const median: number | null = summary.median;

// --- crux / crux-history keep distinct record shapes ---------------------------------------
export async function cruxShapes(): Promise<[CruxReport, CruxHistoryReport]> {
    const single = await runCruxAudit('https://example.com', 'KEY', { scope: 'origin', formFactor: 'phone' });
    const history = await runCruxHistoryAudit('https://example.com', 'KEY', { scope: 'page' });
    return [single, history];
}

export const batch = runCruxBatch(['https://example.com'], 'KEY', {
    scope: 'page',
    concurrency: 2,
    delayMs: 0,
    formFactors: ['phone', 'desktop'],
    onProgress: (done, total, url, error, statusCode) => `${done}/${total}${url}${error}${statusCode}`,
});

// --- the exported defaults are readonly ----------------------------------------------------
export const extended: string[] = [...DEFAULT_CRUX_FORM_FACTORS, 'tablet'];

export const audit = runLabAudit('https://example.com', { profile: 'low', silent: true });
