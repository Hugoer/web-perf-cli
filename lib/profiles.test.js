import { describe, it, expect } from 'vitest';

const {
    buildThrottling,
    buildScreenEmulation,
    resolveProfileSettings,
    LAB_CATEGORIES,
    PROFILES,
    NETWORK_PRESETS,
    DEVICE_PRESETS,
    DEVTOOLS_RTT_ADJUSTMENT_FACTOR,
    DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR,
} = require('./profiles');

// Verbatim copies of the upstream Lantern constants, as of lighthouse v13.4.1 /
// @paulirish/trace_engine. Deliberately inlined rather than imported from node_modules:
// if upstream changes these values, these tests must FAIL so the drift is noticed, not
// silently track the new numbers.
const UPSTREAM_MOBILE_SLOW_4G = {
    rttMs: 150,
    throughputKbps: 1638.4,
    requestLatencyMs: 562.5,
    downloadThroughputKbps: 1474.5600000000002,
    uploadThroughputKbps: 675,
    cpuSlowdownMultiplier: 4,
};

const UPSTREAM_MOBILE_REGULAR_3G = {
    rttMs: 300,
    throughputKbps: 700,
    requestLatencyMs: 1125,
    downloadThroughputKbps: 630,
    uploadThroughputKbps: 630,
    cpuSlowdownMultiplier: 4,
};

describe('LAB_CATEGORIES', () => {
    it('exports the five Lighthouse 13 category IDs', () => {
        expect(LAB_CATEGORIES).toEqual(['performance', 'accessibility', 'best-practices', 'seo', 'agentic-browsing']);
    });
});

describe('buildThrottling', () => {
    it('should return correct throttling object for preset', () => {
        const preset = {
            rttMs: 40,
            throughputKbps: 1000,
            uploadKbps: 500,
            cpuSlowdownMultiplier: 4
        };
        expect(buildThrottling(preset)).toEqual({
            rttMs: 40,
            throughputKbps: 1000,
            requestLatencyMs: 150,
            downloadThroughputKbps: 900,
            uploadThroughputKbps: 450,
            cpuSlowdownMultiplier: 4
        });
    });
});

describe('upstream Lighthouse parity', () => {
    it("emits mobileSlow4G exactly for the '4g' preset (used by --profile=medium)", () => {
        expect(buildThrottling(NETWORK_PRESETS['4g'])).toEqual(UPSTREAM_MOBILE_SLOW_4G);
    });

    it("emits mobileRegular3G exactly for the '3g' preset (used by --profile=low)", () => {
        expect(buildThrottling(NETWORK_PRESETS['3g'])).toEqual(UPSTREAM_MOBILE_REGULAR_3G);
    });

    it('emits the expected upload speed for every preset', () => {
        // Regression guard for the '4g' bug: uploadKbps held 675 (already * 0.9), so
        // buildThrottling applied the factor twice and emitted 607.5 instead of 675.
        // These are the intended emitted values; a preset that stores an already
        // adjusted speed again will diverge from its entry here.
        const expected = {
            '3g-slow': 360,
            '3g': 630,
            '4g': 675,
            '4g-fast': 8100,
            wifi: 13500,
            none: 0,
        };
        expect(Object.keys(expected).sort()).toEqual(Object.keys(NETWORK_PRESETS).sort());
        for (const [name, preset] of Object.entries(NETWORK_PRESETS)) {
            expect(buildThrottling(preset).uploadThroughputKbps, `${name} upload`).toBeCloseTo(expected[name], 6);
        }
    });

    it('applies the DevTools adjustment factors exactly once', () => {
        const preset = { rttMs: 100, throughputKbps: 1000, uploadKbps: 500, cpuSlowdownMultiplier: 2 };
        const result = buildThrottling(preset);
        expect(result.requestLatencyMs).toBe(100 * DEVTOOLS_RTT_ADJUSTMENT_FACTOR);
        expect(result.downloadThroughputKbps).toBe(1000 * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR);
        expect(result.uploadThroughputKbps).toBe(500 * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR);
    });

    it('exposes the adjustment factors as the upstream values', () => {
        expect(DEVTOOLS_RTT_ADJUSTMENT_FACTOR).toBe(3.75);
        expect(DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR).toBe(0.9);
    });
});

describe('buildScreenEmulation', () => {
    it('should return correct screen emulation object', () => {
        const preset = { width: 400, height: 800, deviceScaleFactor: 2, mobile: true };
        expect(buildScreenEmulation(preset)).toEqual({
            mobile: true,
            width: 400,
            height: 800,
            deviceScaleFactor: 2,
            disabled: false,
        });
    });
});

describe('resolveProfileSettings', () => {
    it('should return empty object when called with no arguments', () => {
        expect(resolveProfileSettings()).toEqual({});
        expect(resolveProfileSettings({})).toEqual({});
    });

    it('should resolve profile "low" with mobile settings', () => {
        const result = resolveProfileSettings({ profile: 'low' });
        expect(result.formFactor).toBe('mobile');
        expect(result.emulatedUserAgent).toContain('Android');
        expect(result.throttling).toBeDefined();
        expect(result.screenEmulation).toBeDefined();
        expect(result.throttling.cpuSlowdownMultiplier).toBe(4);
    });

    it('should resolve profile "medium" with mobile settings', () => {
        const result = resolveProfileSettings({ profile: 'medium' });
        expect(result.formFactor).toBe('mobile');
        expect(result.screenEmulation.mobile).toBe(true);
        expect(result.throttling.cpuSlowdownMultiplier).toBe(4);
    });

    it('should resolve profile "high" with desktop settings', () => {
        const result = resolveProfileSettings({ profile: 'high' });
        expect(result.formFactor).toBe('desktop');
        expect(result.emulatedUserAgent).toContain('Macintosh');
        expect(result.screenEmulation.mobile).toBe(false);
        expect(result.throttling.cpuSlowdownMultiplier).toBe(1);
    });

    it('should throw for invalid profile with available options', () => {
        expect(() => resolveProfileSettings({ profile: 'invalid' })).toThrow(
            /Unknown profile "invalid".*low, medium, high, native/
        );
    });

    it('should resolve profile "native" with no throttling and no emulation', () => {
        const result = resolveProfileSettings({ profile: 'native' });
        expect(result.throttlingMethod).toBe('provided');
        expect(result.screenEmulation).toEqual({ disabled: true });
        expect(result.formFactor).toBe('desktop');
        expect(result.throttling.cpuSlowdownMultiplier).toBe(1);
        expect(result.emulatedUserAgent).toBeUndefined();
    });

    it('should throw for invalid network preset', () => {
        expect(() => resolveProfileSettings({ network: 'invalid' })).toThrow(
            /Unknown network preset "invalid"/
        );
    });

    it('should throw for invalid device preset', () => {
        expect(() => resolveProfileSettings({ device: 'invalid' })).toThrow(
            /Unknown device preset "invalid"/
        );
    });

    it('should resolve network-only override', () => {
        const result = resolveProfileSettings({ network: 'wifi' });
        expect(result.throttling).toBeDefined();
        expect(result.throttling.cpuSlowdownMultiplier).toBe(1);
        expect(result.screenEmulation).toBeUndefined();
    });

    it('should resolve device-only override', () => {
        const result = resolveProfileSettings({ device: 'desktop' });
        expect(result.screenEmulation).toBeDefined();
        expect(result.formFactor).toBe('desktop');
        expect(result.throttling).toBeUndefined();
    });

    it('should allow network override on top of profile', () => {
        const result = resolveProfileSettings({ profile: 'low', network: 'wifi' });
        // network override replaces throttling from profile
        expect(result.throttling.cpuSlowdownMultiplier).toBe(1);
        // device from profile is kept
        expect(result.formFactor).toBe('mobile');
    });

    it('should allow device override on top of profile', () => {
        const result = resolveProfileSettings({ profile: 'low', device: 'desktop' });
        // device override replaces screen emulation from profile
        expect(result.formFactor).toBe('desktop');
        expect(result.screenEmulation.mobile).toBe(false);
        expect(result.emulatedUserAgent).toContain('Macintosh');
        // throttling from profile is kept
        expect(result.throttling.cpuSlowdownMultiplier).toBe(4);
    });

    it('should allow both network and device overrides on top of profile', () => {
        const result = resolveProfileSettings({ profile: 'low', network: 'wifi', device: 'desktop' });
        expect(result.throttling.cpuSlowdownMultiplier).toBe(1);
        expect(result.formFactor).toBe('desktop');
        expect(result.screenEmulation.mobile).toBe(false);
    });

    it('should set correct userAgent for mobile device', () => {
        const result = resolveProfileSettings({ device: 'iphone-12' });
        expect(result.emulatedUserAgent).toContain('Android');
        expect(result.emulatedUserAgent).toContain('Mobile');
    });

    it('should set correct userAgent for desktop device', () => {
        const result = resolveProfileSettings({ device: 'desktop-large' });
        expect(result.emulatedUserAgent).toContain('Macintosh');
        expect(result.emulatedUserAgent).not.toContain('Mobile');
    });
});

// This file is an ES module, so it runs in strict mode and a write to a frozen object throws
// instead of failing silently. A consumer in sloppy-mode CommonJS gets the silent no-op —
// still a mutation that never lands, which is the property these tests are about.
describe('exported preset objects are deeply frozen', () => {
    const cases = [
        ['PROFILES', PROFILES, 'low', 'network', 'wifi'],
        ['NETWORK_PRESETS', NETWORK_PRESETS, '3g', 'rttMs', 1],
        ['DEVICE_PRESETS', DEVICE_PRESETS, 'iphone-12', 'width', 9999],
    ];

    it.each(cases)('%s is frozen at both levels', (_name, obj) => {
        expect(Object.isFrozen(obj)).toBe(true);
        for (const entry of Object.values(obj)) {
            expect(Object.isFrozen(entry)).toBe(true);
        }
    });

    // Object.freeze on its own would pass the test above for the container and fail this one:
    // it leaves every nested preset writable, and the nested write is the damaging one.
    it.each(cases)('%s rejects a nested write', (_name, obj, key, prop, value) => {
        const before = obj[key][prop];
        expect(() => {
            obj[key][prop] = value;
        }).toThrow(TypeError);
        expect(obj[key][prop]).toBe(before);
    });

    // The identity check is the assertion that carries this case for a sloppy-mode consumer,
    // where the write is a silent no-op and never throws: `{}` is still an object, so only
    // comparing against the entry held before the write proves the replacement did not land.
    it.each(cases)('%s rejects replacing a whole entry', (_name, obj, key) => {
        const before = obj[key];
        expect(() => {
            obj[key] = {};
        }).toThrow(TypeError);
        expect(obj[key]).toBe(before);
    });

    it.each(cases)('%s still reads nested values', (_name, obj, key, prop) => {
        expect(obj[key][prop]).toBeDefined();
    });

    it.each(cases)('%s can still be extended through a copy', (_name, obj, key, prop, value) => {
        const variant = { ...obj[key], [prop]: value };
        expect(variant[prop]).toBe(value);
        expect(obj[key][prop]).not.toBe(value);
    });

    // The freeze must not change what an audit resolves to — the presets are still the values
    // resolveProfileSettings reads on every run.
    it('leaves resolveProfileSettings reading the same values', () => {
        const settings = resolveProfileSettings({ profile: 'low' });
        expect(settings.throttling.rttMs).toBe(NETWORK_PRESETS['3g'].rttMs);
        expect(settings.screenEmulation.width).toBe(DEVICE_PRESETS['moto-g-power'].width);
    });
});
