/**
 * One entry in NETWORK_PRESETS. Named rather than inline so the published declarations
 * describe a preset once instead of repeating its structure per key.
 */
export type NetworkPreset = {
    /**
     * - nominal round-trip time, in milliseconds
     */
    rttMs: number;
    /**
     * - nominal (pre-adjustment) download speed; `buildThrottling` applies the DevTools factors
     */
    throughputKbps: number;
    /**
     * - nominal (pre-adjustment) upload speed; `buildThrottling` applies the DevTools factors
     */
    uploadKbps: number;
    cpuSlowdownMultiplier: number;
    /**
     * - the one-line summary printed by `list-profiles`
     */
    label: string;
};
/**
 * One entry in DEVICE_PRESETS: the screen emulation and form factor for a device.
 */
export type DevicePreset = {
    width: number;
    height: number;
    deviceScaleFactor: number;
    mobile: boolean;
    formFactor: "mobile" | "desktop";
    /**
     * - the one-line summary printed by `list-profiles`
     */
    label: string;
};
/**
 * One entry in PROFILES: a named pairing of a network preset with a device preset.
 */
export type LabProfile = {
    /**
     * - a NETWORK_PRESETS key, or null for the native profile
     */
    network: string | null;
    /**
     * - a DEVICE_PRESETS key, or null for the native profile
     */
    device: string | null;
    /**
     * - the one-line summary printed by `list-profiles`
     */
    label: string;
};
/**
 * One entry in PROFILES: a named pairing of a network preset with a device preset.
 *
 * @typedef {Object} LabProfile
 * @property {string|null} network - a NETWORK_PRESETS key, or null for the native profile
 * @property {string|null} device - a DEVICE_PRESETS key, or null for the native profile
 * @property {string} label - the one-line summary printed by `list-profiles`
 */
/** @type {Readonly<Record<'low'|'medium'|'high'|'native', Readonly<LabProfile>>>} */
export const PROFILES: Readonly<Record<"low" | "medium" | "high" | "native", Readonly<LabProfile>>>;
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
export const NETWORK_PRESETS: Readonly<Record<"3g-slow" | "3g" | "4g" | "4g-fast" | "wifi" | "none", Readonly<NetworkPreset>>>;
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
export const DEVICE_PRESETS: Readonly<Record<"moto-g-power" | "iphone-12" | "iphone-14" | "ipad" | "desktop" | "desktop-large", Readonly<DevicePreset>>>;
export const LAB_CATEGORIES: readonly string[];
export const DEVTOOLS_RTT_ADJUSTMENT_FACTOR: 3.75;
export const DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR: 0.9;
export const MOBILE_UA: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36";
export const DESKTOP_UA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
/**
 * @param {{ profile?: string, network?: string, device?: string }} [options]
 */
export function resolveProfileSettings({ profile, network, device }?: {
    profile?: string;
    network?: string;
    device?: string;
}): {
    throttlingMethod: string;
    throttling: {
        rttMs: number;
        throughputKbps: number;
        requestLatencyMs: number;
        downloadThroughputKbps: number;
        uploadThroughputKbps: number;
        cpuSlowdownMultiplier: number;
    };
    screenEmulation: {
        mobile: boolean;
        width: number;
        height: number;
        deviceScaleFactor: number;
        disabled: boolean;
    } | {
        disabled: boolean;
    };
    formFactor: any;
    emulatedUserAgent: string;
};
/**
 * Converts a nominal network preset into a Lighthouse `throttling` settings object,
 * applying the DevTools emulation factors. Callers must pass nominal (pre-adjustment)
 * `throughputKbps` and `uploadKbps` — see the INVARIANT note on NETWORK_PRESETS.
 * @param {{ rttMs: number, throughputKbps: number, uploadKbps: number, cpuSlowdownMultiplier: number }} preset
 * @returns {{ rttMs: number, throughputKbps: number, requestLatencyMs: number, downloadThroughputKbps: number, uploadThroughputKbps: number, cpuSlowdownMultiplier: number }}
 */
export function buildThrottling(preset: {
    rttMs: number;
    throughputKbps: number;
    uploadKbps: number;
    cpuSlowdownMultiplier: number;
}): {
    rttMs: number;
    throughputKbps: number;
    requestLatencyMs: number;
    downloadThroughputKbps: number;
    uploadThroughputKbps: number;
    cpuSlowdownMultiplier: number;
};
/**
 * @param {{ mobile: boolean, width: number, height: number, deviceScaleFactor: number }} preset
 */
export function buildScreenEmulation(preset: {
    mobile: boolean;
    width: number;
    height: number;
    deviceScaleFactor: number;
}): {
    mobile: boolean;
    width: number;
    height: number;
    deviceScaleFactor: number;
    disabled: boolean;
};
export function printProfiles(): void;
export function printNetworks(): void;
export function printDevices(): void;
