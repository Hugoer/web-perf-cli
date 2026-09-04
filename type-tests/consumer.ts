// Type-level regression tests for the PUBLISHED declarations in types/.
//
// `npm test` runs the implementation; nothing checked that the .d.ts files describe it. Three
// gaps shipped that way: LabPlanOptions rejected every option the CLI passes, LabReport
// omitted environment/runtimeError/configSettings, and onSummary's argument was typed `object`.
//
// This file imports the package by name, so it resolves through package.json "exports" exactly
// as a consumer's would. It is type-checked only — never executed, never published.
// Run with: npm run check-types

import { runLabPlan, runLabAudit, runLabToDisk } from '@hugoer/web-perf-cli/lab';
import { runCrux, runCruxAudit, runCruxBatch, DEFAULT_CRUX_FORM_FACTORS } from '@hugoer/web-perf-cli/crux';
import { runCruxHistoryAudit } from '@hugoer/web-perf-cli/crux-history';
import { buildRunSummary } from '@hugoer/web-perf-cli/variance';
import { urlSlug, buildFilename } from '@hugoer/web-perf-cli/utils';
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

// --- the exported defaults are readonly, and usable -----------------------------------------
// Passing the constant into the option it is the default for must compile. It did not before:
// `string[]` was never assignable to `CruxFormFactor[]`, so the export was unusable from TS.
export const withDefaults = runCruxBatch(['https://example.com'], 'KEY', {
    formFactors: DEFAULT_CRUX_FORM_FACTORS,
});

// runCrux takes CruxRunOptions while runCruxBatch takes CruxBatchOptions, so the constant has
// to be passed to BOTH: a spread is a mutable array and compiles against either shape, which
// left the readonly widening on CruxRunOptions unguarded.
export const withDefaultsRun = runCrux('https://example.com', 'KEY', {
    formFactors: DEFAULT_CRUX_FORM_FACTORS,
});

// The documented way to extend it must compile too.
export const withExtra = runCrux('https://example.com', 'KEY', {
    formFactors: [...DEFAULT_CRUX_FORM_FACTORS, 'tablet'],
});

// And mutating it must NOT compile. This is the real freeze assertion: annotating a spread as
// `string[]` proved nothing, because spreading a readonly array yields a mutable one either
// way. If the freeze is reverted, this directive goes unused and tsc fails with
// "Unused '@ts-expect-error' directive".
// @ts-expect-error DEFAULT_CRUX_FORM_FACTORS is frozen and published as readonly
DEFAULT_CRUX_FORM_FACTORS.push('tablet');

// --- runLabToDisk's options are typed, not `object` -----------------------------------------
export const toDisk = runLabToDisk('https://example.com', {
    profile: 'low', clean: true, silent: true, skipAudits: ['uses-http2'],
});

// A valid call cannot detect the parameter widening back to `object` — every object literal is
// assignable to `object`. Rejecting an unknown property is what actually pins the type.
// @ts-expect-error runLabToDisk takes LabWriteOptions, not an untyped object
runLabToDisk('https://example.com', { notALabOption: true });

// runNumber and port are owned by runLabPlan and must NOT be accepted plan-level: a caller's
// value survives rather than being overridden. See the LabPlanOptions typedef.
export const rejectsRunNumber = runLabPlan(['u'], [{ profile: 'low' }], {
    // @ts-expect-error runNumber is set by runLabPlan, not by callers
    runNumber: 5,
});
export const rejectsPort = runLabPlan(['u'], [{ profile: 'low' }], {
    // @ts-expect-error port is owned by runLabPlan; passing it silently shares one browser
    port: 9222,
});

export const audit = runLabAudit('https://example.com', { profile: 'low', silent: true });

// --- urlSlug and buildFilename are typed, so a consumer can predict an output path ----------
export const slug: string = urlSlug('https://a.com/es/page-one');
export const filename: string = buildFilename('https://a.com/es/page-one', 'psi', 'mobile');
export const noSuffix: string = buildFilename('https://a.com', 'sitemap', undefined, 'txt');

// @ts-expect-error urlSlug returns a string, never null — callers should not have to narrow it
export const notNullable: null = urlSlug('https://a.com/');
