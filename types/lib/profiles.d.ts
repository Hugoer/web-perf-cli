export namespace PROFILES {
    namespace low {
        let network: string;
        let device: string;
        let label: string;
    }
    namespace medium {
        let network_1: string;
        export { network_1 as network };
        let device_1: string;
        export { device_1 as device };
        let label_1: string;
        export { label_1 as label };
    }
    namespace high {
        let network_2: string;
        export { network_2 as network };
        let device_2: string;
        export { device_2 as device };
        let label_2: string;
        export { label_2 as label };
    }
    namespace native {
        let network_3: null;
        export { network_3 as network };
        let device_3: null;
        export { device_3 as device };
        let label_3: string;
        export { label_3 as label };
    }
}
export const NETWORK_PRESETS: {
    '3g-slow': {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
    '3g': {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
    '4g': {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
    '4g-fast': {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
    wifi: {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
    none: {
        rttMs: number;
        throughputKbps: number;
        uploadKbps: number;
        cpuSlowdownMultiplier: number;
        label: string;
    };
};
export const DEVICE_PRESETS: {
    'moto-g-power': {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
    'iphone-12': {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
    'iphone-14': {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
    ipad: {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
    desktop: {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
    'desktop-large': {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        formFactor: string;
        label: string;
    };
};
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
 * @param {{ rttMs: number, throughputKbps: number, uploadKbps: number, cpuSlowdownMultiplier: number }} preset
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
