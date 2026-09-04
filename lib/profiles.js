const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

// Frozen: exported from web-perf-cli/profiles and used to validate --category input. A
// consumer mutating it would change which categories the CLI accepts.
const LAB_CATEGORIES = Object.freeze(['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing']);

// Lantern's DevTools-emulation factors. Mirrors
// @paulirish/trace_engine/models/trace/lantern/simulation/Constants.js — keep in sync.
const DEVTOOLS_RTT_ADJUSTMENT_FACTOR = 3.75;
const DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR = 0.9;

/**
 * Recursively freezes an object and every nested object it owns.
 *
 * `Object.freeze` on its own is shallow, and shallow is the wrong depth for the presets
 * below: it blocks `PROFILES.low = {...}` but leaves `PROFILES.low.network = 'wifi'`
 * writable, which is the mutation that matters. Every later `--profile=low` audit would
 * then run on WiFi while the report still reports the profile as "low" — a wrong number
 * with nothing signalling it, which is worse than a failed run.
 *
 * The parent is frozen BEFORE recursing, which is what makes the `Object.isFrozen` guard
 * terminate on a self-referential object: freezing afterwards would leave the parent
 * unfrozen when the recursion re-entered it, and the guard would never fire. The guard
 * also skips subtrees that are already frozen.
 *
 * @template {object} T
 * @param {T} obj
 * @returns {T} the same object, now frozen at every level
 */
function deepFreeze(obj) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
        if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    }
    return obj;
}

// INVARIANT: `throughputKbps` and `uploadKbps` are always the NOMINAL (pre-adjustment)
// link speeds, matching how DevTools names its presets. buildThrottling() owns the
// 3.75 / 0.9 factors and is the only place they may be applied. Storing an already
// adjusted value here double-applies the factor — that bug shipped in '4g', whose
// uploadKbps held 675 (= 750 * 0.9) and so emitted 607.5 instead of 675.
/**
 * One entry in NETWORK_PRESETS. Named rather than inline so the published declarations
 * describe a preset once instead of repeating its structure per key.
 *
 * @typedef {Object} NetworkPreset
 * @property {number} rttMs - nominal round-trip time, in milliseconds
 * @property {number} throughputKbps - nominal (pre-adjustment) download speed; `buildThrottling` applies the DevTools factors
 * @property {number} uploadKbps - nominal (pre-adjustment) upload speed; `buildThrottling` applies the DevTools factors
 * @property {number} cpuSlowdownMultiplier
 * @property {string} label - the one-line summary printed by `list-profiles`
 */

/** @type {Readonly<Record<'3g-slow'|'3g'|'4g'|'4g-fast'|'wifi'|'none', Readonly<NetworkPreset>>>} */
const NETWORK_PRESETS = deepFreeze({
    '3g-slow': {
        rttMs: 400,
        throughputKbps: 400,
        uploadKbps: 400,
        cpuSlowdownMultiplier: 4,
        label: 'Slow 3G (400ms RTT, 400 Kbps down, 400 Kbps up, CPU 4x)',
    },
    '3g': {
        rttMs: 300,
        throughputKbps: 700,
        uploadKbps: 700,
        cpuSlowdownMultiplier: 4,
        label: 'Regular 3G (300ms RTT, 700 Kbps down, 700 Kbps up, CPU 4x)',
    },
    '4g': {
        rttMs: 150,
        throughputKbps: 1.6 * 1024,
        uploadKbps: 750,
        cpuSlowdownMultiplier: 4,
        label: 'Slow 4G (150ms RTT, 1.6 Mbps down, 750 Kbps up, CPU 4x)',
    },
    '4g-fast': {
        rttMs: 170,
        throughputKbps: 9000,
        uploadKbps: 9000,
        cpuSlowdownMultiplier: 4,
        label: 'Regular 4G (170ms RTT, 9 Mbps down, 9 Mbps up, CPU 4x)',
    },
    wifi: {
        rttMs: 2,
        throughputKbps: 30000,
        uploadKbps: 15000,
        cpuSlowdownMultiplier: 1,
        label: 'WiFi / Broadband (2ms RTT, 30 Mbps down, 15 Mbps up, CPU 1x)',
    },
    none: {
        rttMs: 0,
        throughputKbps: 0,
        uploadKbps: 0,
        cpuSlowdownMultiplier: 1,
        label: 'No throttling',
    },
});

/**
 * One entry in DEVICE_PRESETS: the screen emulation and form factor for a device.
 *
 * @typedef {Object} DevicePreset
 * @property {number} width
 * @property {number} height
 * @property {number} deviceScaleFactor
 * @property {boolean} mobile
 * @property {'mobile'|'desktop'} formFactor
 * @property {string} label - the one-line summary printed by `list-profiles`
 */

/** @type {Readonly<Record<'moto-g-power'|'iphone-12'|'iphone-14'|'ipad'|'desktop'|'desktop-large', Readonly<DevicePreset>>>} */
const DEVICE_PRESETS = deepFreeze({
    'moto-g-power': {
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        mobile: true,
        formFactor: 'mobile',
        label: '412x823 @ 1.75x (mobile)',
    },
    'iphone-12': {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true,
        formFactor: 'mobile',
        label: '390x844 @ 3x (mobile)',
    },
    'iphone-14': {
        width: 393,
        height: 852,
        deviceScaleFactor: 3,
        mobile: true,
        formFactor: 'mobile',
        label: '393x852 @ 3x (mobile)',
    },
    ipad: {
        width: 810,
        height: 1080,
        deviceScaleFactor: 2,
        mobile: true,
        formFactor: 'mobile',
        label: '810x1080 @ 2x (mobile)',
    },
    desktop: {
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        mobile: false,
        formFactor: 'desktop',
        label: '1350x940 @ 1x (desktop)',
    },
    'desktop-large': {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false,
        formFactor: 'desktop',
        label: '1920x1080 @ 1x (desktop)',
    },
});

/**
 * One entry in PROFILES: a named pairing of a network preset with a device preset.
 *
 * @typedef {Object} LabProfile
 * @property {string|null} network - a NETWORK_PRESETS key, or null for the native profile
 * @property {string|null} device - a DEVICE_PRESETS key, or null for the native profile
 * @property {string} label - the one-line summary printed by `list-profiles`
 */

/** @type {Readonly<Record<'low'|'medium'|'high'|'native', Readonly<LabProfile>>>} */
const PROFILES = deepFreeze({
    low: {
        network: '3g',
        device: 'moto-g-power',
        label: 'Budget phone on 3G (Moto G Power, Regular 3G, CPU 4x)',
    },
    medium: {
        network: '4g',
        device: 'moto-g-power',
        label: 'Mid-range phone on 4G (Moto G Power, Slow 4G, CPU 4x) [Lighthouse default]',
    },
    high: {
        network: 'wifi',
        device: 'desktop',
        label: 'Desktop on broadband (Desktop 1350x940, WiFi, CPU 1x)',
    },
    native: {
        network: null,
        device: null,
        label: 'Native device (no throttling, no emulation — actual hardware)',
    },
});

/**
 * Converts a nominal network preset into a Lighthouse `throttling` settings object,
 * applying the DevTools emulation factors. Callers must pass nominal (pre-adjustment)
 * `throughputKbps` and `uploadKbps` — see the INVARIANT note on NETWORK_PRESETS.
 * @param {{ rttMs: number, throughputKbps: number, uploadKbps: number, cpuSlowdownMultiplier: number }} preset
 * @returns {{ rttMs: number, throughputKbps: number, requestLatencyMs: number, downloadThroughputKbps: number, uploadThroughputKbps: number, cpuSlowdownMultiplier: number }}
 */
function buildThrottling(preset) {
    return {
        rttMs: preset.rttMs,
        throughputKbps: preset.throughputKbps,
        requestLatencyMs: preset.rttMs * DEVTOOLS_RTT_ADJUSTMENT_FACTOR,
        downloadThroughputKbps: preset.throughputKbps * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR,
        uploadThroughputKbps: preset.uploadKbps * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR,
        cpuSlowdownMultiplier: preset.cpuSlowdownMultiplier,
    };
}

/**
 * @param {{ mobile: boolean, width: number, height: number, deviceScaleFactor: number }} preset
 */
function buildScreenEmulation(preset) {
    return {
        mobile: preset.mobile,
        width: preset.width,
        height: preset.height,
        deviceScaleFactor: preset.deviceScaleFactor,
        disabled: false,
    };
}

/**
 * @param {{ profile?: string, network?: string, device?: string }} [options]
 */
function resolveProfileSettings({ profile, network, device } = {}) {
    const settings = {};

    if (profile) {
        if (!PROFILES[profile]) {
            const valid = Object.keys(PROFILES).join(', ');
            throw new Error(`Unknown profile "${profile}". Available profiles: ${valid}`);
        }
        const p = PROFILES[profile];

        if (p.network === null && p.device === null) {
            settings.throttlingMethod = 'provided';
            settings.throttling = buildThrottling(NETWORK_PRESETS.none);
            settings.screenEmulation = { disabled: true };
            settings.formFactor = 'desktop';
        } else {
            const net = NETWORK_PRESETS[p.network];
            const dev = DEVICE_PRESETS[p.device];
            settings.throttling = buildThrottling(net);
            settings.screenEmulation = buildScreenEmulation(dev);
            settings.formFactor = dev.formFactor;
            settings.emulatedUserAgent = dev.mobile ? MOBILE_UA : DESKTOP_UA;
        }
    }

    if (network) {
        if (!NETWORK_PRESETS[network]) {
            const valid = Object.keys(NETWORK_PRESETS).join(', ');
            throw new Error(`Unknown network preset "${network}". Available presets: ${valid}`);
        }
        settings.throttling = buildThrottling(NETWORK_PRESETS[network]);
    }

    if (device) {
        if (!DEVICE_PRESETS[device]) {
            const valid = Object.keys(DEVICE_PRESETS).join(', ');
            throw new Error(`Unknown device preset "${device}". Available presets: ${valid}`);
        }
        const dev = DEVICE_PRESETS[device];
        settings.screenEmulation = buildScreenEmulation(dev);
        settings.formFactor = dev.formFactor;
        settings.emulatedUserAgent = dev.mobile ? MOBILE_UA : DESKTOP_UA;
    }

    return settings;
}

function printProfiles() {
    console.log('\nAvailable profiles:');
    for (const [name, p] of Object.entries(PROFILES)) {
        console.log(`  ${name.padEnd(10)} ${p.label}`);
    }
    console.log();
}

function printNetworks() {
    console.log('\nAvailable network presets:');
    for (const [name, n] of Object.entries(NETWORK_PRESETS)) {
        console.log(`  ${name.padEnd(10)} ${n.label}`);
    }
    console.log();
}

function printDevices() {
    console.log('\nAvailable device presets:');
    for (const [name, d] of Object.entries(DEVICE_PRESETS)) {
        console.log(`  ${name.padEnd(16)} ${d.label}`);
    }
    console.log();
}

module.exports = {
    PROFILES,
    NETWORK_PRESETS,
    DEVICE_PRESETS,
    LAB_CATEGORIES,
    DEVTOOLS_RTT_ADJUSTMENT_FACTOR,
    DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR,
    MOBILE_UA,
    DESKTOP_UA,
    resolveProfileSettings,
    buildThrottling,
    buildScreenEmulation,
    printProfiles,
    printNetworks,
    printDevices,
};
