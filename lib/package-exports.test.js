import { describe, it, expect } from 'vitest';

const pkg = require('../package.json');

describe('package.json main field', () => {
    it('points to lib/index.js, not the CLI entrypoint', () => {
        expect(pkg.main).toBe('lib/index.js');
    });
});

describe('package root exports', () => {
    const lib = require('.');

    it('exports runLabAudit', () => {
        expect(typeof lib.runLabAudit).toBe('function');
    });

    it('exports runPsiAudit', () => {
        expect(typeof lib.runPsiAudit).toBe('function');
    });

    it('exports runCruxAudit', () => {
        expect(typeof lib.runCruxAudit).toBe('function');
    });

    it('exports runCruxHistoryAudit', () => {
        expect(typeof lib.runCruxHistoryAudit).toBe('function');
    });

    it('exports CHROME_FLAGS as an array', () => {
        expect(Array.isArray(lib.CHROME_FLAGS)).toBe(true);
    });
});
