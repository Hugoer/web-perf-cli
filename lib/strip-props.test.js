import { describe, it, expect } from 'vitest';

const { stripJsonProps, STRIP_KEYS } = require('./strip-props');

describe('STRIP_KEYS', () => {
    it('exports the expected default keys', () => {
        expect(STRIP_KEYS).toEqual(['i18n', 'timing']);
    });
});

describe('stripJsonProps', () => {
    it('removes i18n and timing from root by default', () => {
        const input = { lhr: 1, i18n: { foo: 'bar' }, timing: [1, 2], audits: {} };
        const result = stripJsonProps(input);
        expect(result).toEqual({ lhr: 1, audits: {} });
    });

    it('does not mutate the original object', () => {
        const input = { i18n: 'x', timing: 'y', keep: 1 };
        stripJsonProps(input);
        expect(input).toEqual({ i18n: 'x', timing: 'y', keep: 1 });
    });

    it('returns object unchanged when no keys match', () => {
        const input = { lhr: 1, audits: {} };
        expect(stripJsonProps(input)).toEqual({ lhr: 1, audits: {} });
    });

    it('handles partial match (only one key present)', () => {
        const input = { i18n: {}, keep: true };
        expect(stripJsonProps(input)).toEqual({ keep: true });
    });

    it('accepts a custom keys array', () => {
        const input = { foo: 1, bar: 2, baz: 3 };
        expect(stripJsonProps(input, ['foo', 'bar'])).toEqual({ baz: 3 });
    });

    it('returns object unchanged when keys array is empty', () => {
        const input = { i18n: 1, timing: 2 };
        expect(stripJsonProps(input, [])).toEqual({ i18n: 1, timing: 2 });
    });

    it('returns null unchanged', () => {
        expect(stripJsonProps(null)).toBeNull();
    });

    it('returns a string unchanged', () => {
        expect(stripJsonProps('hello')).toBe('hello');
    });

    it('returns a number unchanged', () => {
        expect(stripJsonProps(42)).toBe(42);
    });

    it('returns an array unchanged (not treated as object)', () => {
        const arr = [{ i18n: 1 }, { timing: 2 }];
        expect(stripJsonProps(arr)).toBe(arr);
    });

    it('does not strip nested keys (shallow only)', () => {
        const input = { nested: { i18n: 'deep', timing: 'deep' }, top: 1 };
        const result = stripJsonProps(input);
        expect(result.nested).toEqual({ i18n: 'deep', timing: 'deep' });
        expect(result.top).toBe(1);
    });
});
