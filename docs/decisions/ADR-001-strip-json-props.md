# ADR-001: Strip Noise Properties from Lighthouse JSON Output

## Status
Accepted

## Date
2026-04-09

## Context

Lighthouse JSON reports are large (~20 MB per run) and contain metadata properties (`i18n` for localization data, `timing` for internal Lighthouse timings) that are rarely useful for performance analysis. These properties waste storage and network bandwidth when uploading results to external systems.

Users running multiple audits need file sizes to be reasonable. Performance engineers analyzing Lighthouse data care about performance metrics (LCP, CLS, FID, etc.), not Lighthouse internals.

## Decision

Add `--no-strip-json-props` CLI flag to the `lab` command. When enabled (default), strip `i18n` and `timing` from the root level of the Lighthouse JSON before writing the file. Users can disable with `--no-strip-json-props` to get the raw unmodified output.

## Alternatives Considered

### 1. Post-processing (external tool)
- Pros: Doesn't touch the lab command; users can choose
- Cons: Requires manual setup; doesn't solve the problem for most users; adds complexity
- Rejected: Better to make the useful default the default

### 2. Compress the output (gzip)
- Pros: Smaller files, doesn't lose data
- Cons: Requires decompression; doesn't address the core issue (the data is unused)
- Rejected: Stripping unused data is more direct than compression; allows cleaner JSON for human inspection

### 3. Deep/recursive stripping
- Pros: Removes `i18n`/`timing` everywhere in the tree, not just root
- Cons: Slower; future-proofing for data we don't currently see nested
- Rejected: Start with shallow (root-level only); upgrade to deep later if needed

### 4. Configurable property list
- Pros: Flexible for future use cases
- Cons: Complexity; users should rarely need this
- Rejected: Start with hardcoded `STRIP_KEYS`; make configurable if demand emerges

## Implementation Details

### Module: `lib/strip-props.js`
Standalone utility with `stripJsonProps(obj, keys = STRIP_KEYS)`. Shallow removal only — future upgrades can add a `{ deep: true }` option without changing the signature.

### CLI Flag: Commander's `--no-*` Negation
Used Commander's `--no-strip-json-props` pattern: `options.stripJsonProps` is `true` by default, `false` when the flag is passed. This achieves opt-out semantics naturally.

**Bug Found & Fixed:** Commander always sets the default, so `options.stripJsonProps` is never `undefined`. The interactive prompt couldn't distinguish "user didn't specify" from "Commander default". Fixed with `cmd.getOptionValueSource('stripJsonProps')` to detect explicit CLI flags vs. defaults.

### Behavior

```bash
# Default (strips i18n, timing)
node bin/web-perf.js lab <url>

# Explicitly enable
node bin/web-perf.js lab --strip-json-props <url>  # same as default

# Disable (raw Lighthouse output)
node bin/web-perf.js lab --no-strip-json-props <url>

# Interactive prompt (no CLI flags provided)
node bin/web-perf.js lab
# ? Allow strip unneeded properties? (Y/n)
```

## Consequences

- Default behavior removes ~5–10% of file size (depends on Lighthouse version)
- Raw mode (`--no-strip-json-props`) avoids the parse/stringify cycle, preserving byte-for-byte original output
- Stripping is shallow today; upgrading to recursive is a non-breaking change (same API)
- Test coverage includes regression test for the Commander flag-source bug (prevents silent reoccurrence)

## Related Decisions

Future: Consider deep/recursive stripping if use cases emerge for nested properties.
