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
import { LAB_CATEGORIES, PROFILES, NETWORK_PRESETS, DEVICE_PRESETS } from '@hugoer/web-perf-cli/profiles';
import type { LabProfile, NetworkPreset, DevicePreset } from '@hugoer/web-perf-cli/profiles';

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

// --- profile, network and device presets ----------------------------------------------------
// These are objects, not arrays, so the mutation that matters is one level down: freezing the
// container alone leaves PROFILES.low.network writable, and that write changes what every
// later audit measures while the report still names the original profile.
export const profile: LabProfile = PROFILES.low;
export const network: NetworkPreset = NETWORK_PRESETS['3g'];
export const device: DevicePreset = DEVICE_PRESETS['iphone-12'];

export const rttMs: number = NETWORK_PRESETS['3g'].rttMs;
export const formFactor: 'mobile' | 'desktop' = DEVICE_PRESETS.desktop.formFactor;
export const profileNetwork: string | null = PROFILES.native.network;

// The supported way to build a variant: spread, do not mutate.
export const slowerThan3g: NetworkPreset = { ...NETWORK_PRESETS['3g'], rttMs: 250 };
export const taller: DevicePreset = { ...DEVICE_PRESETS['iphone-12'], height: 1000 };
export const onWifi: LabProfile = { ...PROFILES.low, network: 'wifi' };

// @ts-expect-error PROFILES entries are frozen and published as readonly
PROFILES.low.network = 'wifi';
// @ts-expect-error NETWORK_PRESETS entries are frozen and published as readonly
NETWORK_PRESETS['3g'].rttMs = 1;
// @ts-expect-error DEVICE_PRESETS entries are frozen and published as readonly
DEVICE_PRESETS['iphone-12'].width = 9999;

// Replacing a whole entry is blocked too — the container itself is readonly.
// @ts-expect-error PROFILES is frozen and published as readonly
PROFILES.low = onWifi;
// @ts-expect-error NETWORK_PRESETS is frozen and published as readonly
NETWORK_PRESETS['3g'] = slowerThan3g;
// @ts-expect-error DEVICE_PRESETS is frozen and published as readonly
DEVICE_PRESETS['iphone-12'] = taller;
