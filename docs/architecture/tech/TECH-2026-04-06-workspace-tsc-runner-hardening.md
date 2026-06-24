> Migrated from `docs/review/2026-04-06-workspace-tsc-runner-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Workspace TypeScript Runner Hardening

## Scope

This iteration fixed the automation gate for the workspace TypeScript runner.

Files changed:

- `scripts/run-workspace-tsc.mjs`
- `scripts/run-workspace-tsc.test.mjs`

## Problem

After the cross-workspace loader fix, the next failing gate was:

- `pnpm.cmd check:automation`

The failure was not in CI flow logic or release flow logic. It failed before
those stages because `scripts/run-workspace-tsc.mjs` could not locate the
TypeScript CLI and raised:

- `Unable to resolve workspace TypeScript CLI.`

## Root Cause

The runner assumed the workspace TypeScript CLI always lived at:

- `typescript/lib/tsc.js`

That assumption no longer holds for the installed TypeScript version in this
workspace:

- `typescript@6.0.2`

In the current package layout, the runnable compiler entrypoint is available
under:

- `typescript/lib/_tsc.js`

So the automation gate was coupled to an older internal TypeScript package
layout rather than resolving the current workspace package truthfully.

## Implementation

### 1. Added the regression expectation first

Updated `scripts/run-workspace-tsc.test.mjs` so the runner is required to accept
the current TypeScript 6 CLI layout:

- `typescript/lib/_tsc.js`

while remaining compatible with the older:

- `typescript/lib/tsc.js`

### 2. Hardened CLI resolution across TypeScript package layouts

Updated `scripts/run-workspace-tsc.mjs` to resolve the first valid entry from a
small ordered candidate set:

1. `typescript/lib/tsc.js`
2. `typescript/lib/_tsc.js`
3. package-root direct file probes for both of the above
4. legacy `.ignored` fallbacks for both variants

This keeps the runner compatible with both TypeScript 5-era and TypeScript 6
package layouts.

## Verification

Verified in this iteration:

- `node scripts/run-workspace-tsc.test.mjs`
- `pnpm.cmd check:automation`

Additional fresh evidence from the same phase:

- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd check:release-flow`

All passed on 2026-04-06 after the fix.

## Result

The workspace automation gate is no longer blocked by a stale assumption about
the TypeScript CLI internals.

This restores confidence in:

- the local automation guard
- release-flow verification
- CI-flow verification
- the regression loop that now depends on both the loader and the workspace TSC
  runner being truthful

## Remaining Risk

The current verification matrix is strong at the contract and regression level,
but it still does not replace a live packaged runtime smoke in a real installer
environment on:

- Windows
- Linux
- macOS

It also does not replace a live desktop chat request flowing into a real
built-in OpenClaw runtime process inside this sandbox.

## Next Iteration

Recommended next step:

1. perform a live desktop chat/bootstrap to built-in OpenClaw gateway smoke with
   runtime evidence capture
2. record the resulting runtime evidence in `docs/review/`
3. keep the current automation gates as mandatory preconditions for every
   further OpenClaw/runtime iteration

