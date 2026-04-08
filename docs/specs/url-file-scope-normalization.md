# Spec: URL File Scope and Normalization Consistency

## Objective
Ensure `psi`, `crux`, and `crux-history` handle `--urls-file` consistently in non-interactive CLI usage, and prevent unintended origin-only normalization when URL lists are intended to run at page scope.

Primary user: engineer running batch audits from CI or shell scripts.

Success means:
- `--urls-file` works in non-interactive mode when required flags are provided.
- For CRUX commands, URL list inputs (`--urls`, `--urls-file`) default to page scope unless explicitly overridden.
- URL list inputs are not collapsed to origin due to implicit scope defaults.

## Tech Stack
- Node.js CommonJS CLI
- commander
- inquirer
- vitest

## Commands
- Test: `npm test`
- Run single command examples:
  - `node bin/web-perf.js psi --urls-file=urls.txt --api-key=KEY --category=performance`
  - `node bin/web-perf.js crux --urls-file=urls.txt --api-key=KEY`
  - `node bin/web-perf.js crux-history --urls-file=urls.txt --api-key=KEY`

## Project Structure
- `bin/web-perf.js`: CLI command wiring and option definitions
- `lib/prompts.js`: argument/prompt resolution, URL normalization, scope selection
- `lib/prompts.test.js`: behavior tests for prompt resolvers
- `README.md`: user-facing command semantics
- `docs/specs/`: technical specs

## Code Style
Use small pure helpers for decision logic and call interactive prompts only when required values are missing.

```js
function resolveDefaultScope(options) {
    const hasUrlList = Boolean(options.urls || options.urlsFile);
    if (options.scope) {
        return options.scope;
    }
    return hasUrlList ? 'page' : null;
}
```

Conventions:
- Preserve existing 4-space indentation and naming style.
- Keep side effects local to prompt functions.
- Avoid changing public function signatures unless necessary.

## Testing Strategy
- Framework: vitest (`npm test`)
- Test location: `lib/*.test.js`
- Add regression tests for:
  - non-TTY execution with complete flags
  - CRUX default scope when `--urls` or `--urls-file` is supplied
  - preservation of page URLs under page scope
- Keep existing assertions for interactive prompting behavior where still valid.

## Boundaries
- Always: keep backward compatibility for explicit `--scope`; run tests after edits; update docs for CLI behavior changes.
- Ask first: new dependencies; changes to API output schema; command name or flag renames.
- Never: commit secrets; remove test coverage for changed behavior; silently change explicit `--scope=origin` semantics.

## Success Criteria
- `promptPsi` does not require TTY when all required values are provided by flags/env.
- `promptCrux` and `promptCruxHistory` default to `page` scope when URL lists are provided and `--scope` is omitted.
- CRUX URL list page inputs remain page URLs (not normalized to origin) unless explicit `--scope=origin` is set.
- README reflects scope default behavior for URL-list runs.
- Test suite passes.

## Open Questions
- Should interactive runs with no scope continue prompting, or always default to origin? Proposed behavior: keep prompt in interactive runs without URL list for backward compatibility.

## Assumptions
1. URL-list based CRUX/CRUX History runs should target page-level metrics by default.
2. Explicit `--scope=origin` remains valid and should still normalize to origins.
3. Existing URL normalization (query/hash removal + dedupe) remains unchanged for all commands.
4. Non-interactive behavior is required for CI and script usage.

## Implementation Plan
1. Adjust scope resolution in `promptCrux` to infer `page` when URL list inputs are present and scope is omitted.
2. Remove unconditional TTY gating from `promptPsi`, `promptCrux`, and `promptCruxHistory`; prompt only when required data is missing.
3. Add regression tests for non-interactive fully-flagged usage and inferred scope.
4. Update README command docs to describe URL-list scope inference.
5. Run tests and confirm no regressions.

## Task Breakdown
- [ ] Task: Add scope inference and conditional prompting in prompt resolvers
  - Acceptance: prompt resolvers return complete config from flags/env without TTY when possible
  - Verify: `npm test`
  - Files: `lib/prompts.js`

- [ ] Task: Add prompt resolver regression tests
  - Acceptance: tests cover inferred scope and non-TTY URL-file behavior
  - Verify: `npm test`
  - Files: `lib/prompts.test.js`

- [ ] Task: Update command documentation for scope inference
  - Acceptance: docs describe URL-list default behavior clearly
  - Verify: read rendered README sections
  - Files: `README.md`
