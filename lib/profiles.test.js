import { describe, it, expect } from 'vitest';

const { buildThrottling, buildScreenEmulation, resolveProfileSettings } = require('./profiles');

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
            /Unknown profile "invalid".*low, medium, high/
        );
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
