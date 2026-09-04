import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { execFileSync } = require('child_process');
const fs = require('fs');
const { builtinModules } = require('module');
const os = require('os');
const path = require('path');

const pkg = require('../package.json');

// Does the PUBLISHED TARBALL work?
//
// Both consumer-facing guards read the working tree, so neither consults package.json "files":
//   - examples/ installs with `file:..`, which SYMLINKS the repo root rather than packing it.
//   - type-tests/ resolves the package through self-reference.
// A lib/ module left out of "files" therefore resolves in both, passes CI, and breaks only for a
// real consumer after publish. package-exports.test.js does not cover it either: `require('.')`
// from inside lib/ lands on lib/index.js directly, never touching the root "exports" map.
//
// This packs the tarball, extracts it, and requires every published subpath BY NAME from a
// directory where the extracted copy is the installed dependency — so resolution runs through
// "exports" exactly as a consumer's would.
//
// The package's own dependencies are symlinked from the repo's node_modules rather than
// installed, which keeps this offline and ~2s instead of a full network install. The trade-off is
// that a dependency used but never declared would still resolve, so the last test covers that by
// reading the source instead.

const REPO_ROOT = path.join(__dirname, '..');

/** Package-name specifiers for every subpath in "exports": '.' -> '@scope/name'. */
const SPECIFIERS = Object.keys(pkg.exports).map(
    (subpath) => path.posix.join(pkg.name, subpath),
);

/** Every packed .js file that ships as runtime code — test files are not it. */
function runtimeFiles(root) {
    const found = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
                found.push(full);
            }
        }
    };
    for (const dir of ['bin', 'lib']) {
        walk(path.join(root, dir));
    }
    return found;
}

describe('published tarball', () => {
    let workdir;
    let extracted;
    let loaded;

    beforeAll(() => {
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-perf-tarball-'));
        const packDir = path.join(workdir, 'pack');
        fs.mkdirSync(packDir);

        // --cache keeps this off the user's shared npm cache, which can be unwritable.
        const tarball = execFileSync(
            'npm',
            ['pack', '--silent', '--pack-destination', packDir, '--cache', path.join(workdir, 'npm-cache')],
            { cwd: REPO_ROOT, encoding: 'utf8' },
        ).trim();
        execFileSync('tar', ['-xzf', path.join(packDir, tarball), '-C', packDir]);
        extracted = path.join(packDir, 'package');

        fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(extracted, 'node_modules'));

        // The extracted copy has to sit in a node_modules under its published name, or requiring
        // it by name would never consult the "exports" map.
        const consumer = path.join(workdir, 'consumer');
        fs.mkdirSync(path.join(consumer, 'node_modules', path.dirname(pkg.name)), { recursive: true });
        fs.symlinkSync(extracted, path.join(consumer, 'node_modules', pkg.name));

        // Loading happens in a child process: this test file lives in the repo, where the same
        // specifiers would resolve by self-reference and prove nothing about the tarball.
        const probe = path.join(consumer, 'probe.js');
        fs.writeFileSync(probe, [
            'const out = {};',
            `for (const spec of ${JSON.stringify(SPECIFIERS)}) {`,
            '    try {',
            '        out[spec] = { names: Object.keys(require(spec)).length };',
            '    } catch (err) {',
            '        out[spec] = { error: err.message.split(String.fromCharCode(10))[0] };',
            '    }',
            '}',
            'process.stdout.write(JSON.stringify(out));',
        ].join('\n'));
        loaded = JSON.parse(execFileSync(process.execPath, [probe], { cwd: consumer, encoding: 'utf8' }));
    }, 120000);

    afterAll(() => {
        if (workdir) {
            fs.rmSync(workdir, { recursive: true, force: true });
        }
    });

    it('ships every file "exports" points at, in every condition', () => {
        const missing = [];
        for (const [subpath, conditions] of Object.entries(pkg.exports)) {
            for (const [condition, target] of Object.entries(conditions)) {
                if (!fs.existsSync(path.join(extracted, target))) {
                    missing.push(`${subpath} [${condition}] -> ${target}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('ships the "main", "types" and "bin" entrypoints', () => {
        const entrypoints = [pkg.main, pkg.types, ...Object.values(pkg.bin)];
        const missing = entrypoints.filter((rel) => !fs.existsSync(path.join(extracted, rel)));
        expect(missing).toEqual([]);
    });

    it.each(SPECIFIERS)('%s loads from an installed copy', (spec) => {
        // Reported as the error string rather than a boolean so a failure names the missing file.
        expect(loaded[spec].error ?? null).toBeNull();
        expect(loaded[spec].names).toBeGreaterThan(0);
    });

    it('declares every dependency its runtime code requires', () => {
        const declared = new Set(Object.keys(pkg.dependencies));
        const undeclared = new Set();

        for (const file of runtimeFiles(extracted)) {
            const source = fs.readFileSync(file, 'utf8');
            // Dynamic import() is matched too: lighthouse is only ever reached that way.
            const bare = [...source.matchAll(/(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)]
                .map(([, spec]) => spec)
                .filter((spec) => !spec.startsWith('.') && !spec.startsWith('node:'));

            for (const spec of bare) {
                const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
                if (!builtinModules.includes(name) && !declared.has(name)) {
                    undeclared.add(`${path.relative(extracted, file)} -> ${name}`);
                }
            }
        }

        expect([...undeclared]).toEqual([]);
    });
});
