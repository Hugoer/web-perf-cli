// The package root: types/lib/index.d.ts is what package.json's top-level "types" field names
// and what most consumers resolve, yet it was the one declaration set the guard did not cover.
// Covering it immediately found that the type import the README documents did not compile.

import { runCruxAudit, runPsiAudit, runLabAudit, CHROME_FLAGS, normalizeOrigin } from '@hugoer/web-perf-cli';
import type {
    LabReport, LabPlanResult, PsiReport, PsiBatchResult,
    CruxReport, CruxMetric, CruxBatchResult, CruxFormFactor,
    CruxHistoryReport, CruxHistoryBatchResult, RunSummary,
} from '@hugoer/web-perf-cli';

export const fns = [runCruxAudit, runPsiAudit, runLabAudit, normalizeOrigin];
export const flags: readonly string[] = CHROME_FLAGS;

// Every row of the README's "Key exported types" table must resolve from the root.
export type Rows = [
    LabReport, LabPlanResult, PsiReport, PsiBatchResult,
    CruxReport, CruxMetric, CruxBatchResult, CruxFormFactor,
    CruxHistoryReport, CruxHistoryBatchResult, RunSummary,
];
