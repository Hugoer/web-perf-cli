// Every exported constant that is ALSO a default argument must be readonly, must carry its
// element type, and must still be passable to the option it is the default for.
//
// Freezing alone is not enough — that was the lesson from the CrUX pair. Declared `string[]`,
// the constant could never be passed back into `formFactors`, so the freeze only changed the
// error code from TS2322 to TS4104. Each constant below is therefore asserted three ways:
// pass it in, spread it to extend, and fail to mutate it.

import { runPsi, runPsiBatch, PSI_STRATEGIES, DEFAULT_PSI_STRATEGIES } from '@hugoer/web-perf-cli/psi';
import { runCrux, DEFAULT_CRUX_FORM_FACTORS } from '@hugoer/web-perf-cli/crux';
import { buildLighthouseConfig, CHROME_FLAGS, DEFAULT_SKIP_AUDITS } from '@hugoer/web-perf-cli/lab';
import { LAB_CATEGORIES } from '@hugoer/web-perf-cli/profiles';

// --- PSI strategies -------------------------------------------------------------------------
export const psiDefault = runPsi('https://example.com', 'KEY', undefined, {
    strategies: DEFAULT_PSI_STRATEGIES,
});
export const psiBatch = runPsiBatch(['https://example.com'], 'KEY', ['PERFORMANCE'], {
    strategies: PSI_STRATEGIES,
});
export const psiExtended = runPsi('https://example.com', 'KEY', undefined, {
    strategies: [...DEFAULT_PSI_STRATEGIES],
});
// @ts-expect-error DEFAULT_PSI_STRATEGIES is frozen and published as readonly
DEFAULT_PSI_STRATEGIES.push('mobile');
// @ts-expect-error PSI_STRATEGIES is frozen and published as readonly
PSI_STRATEGIES.push('mobile');

// --- CrUX form factors (fixed earlier; asserted here alongside the rest) ---------------------
export const cruxDefault = runCrux('https://example.com', 'KEY', {
    formFactors: DEFAULT_CRUX_FORM_FACTORS,
});
// @ts-expect-error DEFAULT_CRUX_FORM_FACTORS is frozen and published as readonly
DEFAULT_CRUX_FORM_FACTORS.push('tablet');

// --- lab: skipped audits and Chrome flags ---------------------------------------------------
export const config = buildLighthouseConfig({ skipAudits: [...DEFAULT_SKIP_AUDITS] }, {});
// @ts-expect-error DEFAULT_SKIP_AUDITS is frozen and published as readonly
DEFAULT_SKIP_AUDITS.push('uses-http2');

// chrome-launcher types chromeFlags as a mutable Array<string>, so a consumer must spread.
// This is the documented shape of that workaround, and it has to keep compiling.
export const launchFlags: string[] = [...CHROME_FLAGS];
// @ts-expect-error CHROME_FLAGS is frozen and published as readonly
CHROME_FLAGS.push('--headless=new');

// --- lab categories -------------------------------------------------------------------------
export const categories: string[] = [...LAB_CATEGORIES];
// @ts-expect-error LAB_CATEGORIES is frozen and published as readonly
LAB_CATEGORIES.push('performance');
