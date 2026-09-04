declare namespace _exports {
    export { LabReport, LabPlanResult, PsiReport, PsiBatchResult, CruxReport, CruxMetric, CruxBatchResult, CruxFormFactor, CruxHistoryReport, CruxHistoryBatchResult, LabProfile, NetworkPreset, DevicePreset, RunSummary };
}
declare namespace _exports {
    const runLabAudit: typeof import("./lab").runLabAudit;
    const runPsiAudit: typeof import("./psi").runPsiAudit;
    const runCruxAudit: typeof import("./crux").runCruxAudit;
    const runCruxHistoryAudit: typeof import("./crux-history").runCruxHistoryAudit;
    const runPsiAuditBatch: typeof import("./psi").runPsiAuditBatch;
    const runCruxAuditBatch: typeof import("./crux").runCruxAuditBatch;
    const runCruxHistoryAuditBatch: typeof import("./crux-history").runCruxHistoryAuditBatch;
    const runLab: typeof import("./lab").runLab;
    const runPsi: typeof import("./psi").runPsi;
    const runCrux: typeof import("./crux").runCrux;
    const runCruxHistory: typeof import("./crux-history").runCruxHistory;
    const runPsiBatch: typeof import("./psi").runPsiBatch;
    const runCruxBatch: typeof import("./crux").runCruxBatch;
    const runCruxHistoryBatch: typeof import("./crux-history").runCruxHistoryBatch;
    const buildLighthouseConfig: typeof import("./lab").buildLighthouseConfig;
    const CHROME_FLAGS: typeof import("./lab").CHROME_FLAGS;
    const DEFAULT_SKIP_AUDITS: typeof import("./lab").DEFAULT_SKIP_AUDITS;
    const sleep: typeof import("./utils").sleep;
    const createRateLimiter: typeof import("./utils").createRateLimiter;
    const normalizeOrigin: typeof import("./utils").normalizeOrigin;
    const PSI_MAX_REQUESTS_PER_SECOND: typeof import("./psi").PSI_MAX_REQUESTS_PER_SECOND;
    const CRUX_MAX_REQUESTS_PER_SECOND: typeof import("./crux").CRUX_MAX_REQUESTS_PER_SECOND;
    const CRUX_HISTORY_MAX_REQUESTS_PER_SECOND: typeof import("./crux-history").CRUX_HISTORY_MAX_REQUESTS_PER_SECOND;
}
export = _exports;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type LabReport = import("./lab").LabReport;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type LabPlanResult = import("./lab").LabPlanResult;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type PsiReport = import("./psi").PsiReport;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type PsiBatchResult = import("./psi").PsiBatchResult;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxReport = import("./crux").CruxReport;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxMetric = import("./crux").CruxMetric;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxBatchResult = import("./crux").CruxBatchResult;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxFormFactor = import("./crux").CruxFormFactor;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxHistoryReport = import("./crux-history").CruxHistoryReport;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type CruxHistoryBatchResult = import("./crux-history").CruxHistoryBatchResult;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type LabProfile = import("./profiles").LabProfile;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type NetworkPreset = import("./profiles").NetworkPreset;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type DevicePreset = import("./profiles").DevicePreset;
/**
 * The types the README's "Key exported types" table promises from the package root. Re-declared
 * here because lib/index.js is a value-only façade of lazy getters: without these, the
 * documented `import type { CruxReport } from '@hugoer/web-perf-cli'` fails with TS2305.
 */
type RunSummary = import("./variance").RunSummary;
