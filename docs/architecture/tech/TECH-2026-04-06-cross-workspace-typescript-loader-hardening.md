> Migrated from `docs/review/2026-04-06-cross-workspace-typescript-loader-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Cross-Workspace TypeScript Loader Hardening

## Scope

This iteration fixed the Node TypeScript test loader that powers cross-package
regression checks inside the Claw Studio workspace.

Files changed:

- `scripts/ts-extension-loader.mjs`
- `scripts/ts-extension-loader.test.mjs`

## Problem

Several higher-level TypeScript regression tests were not failing because of
product logic. They were failing before execution because the Node loader could
not resolve sibling workspace packages that live outside this workspace's local
`packages/` directory.

Observed blocked tests:

- `packages/sdkwork-clawstudio-settings/src/services/localAiProxyLogsService.test.ts`
- `packages/sdkwork-clawstudio-core/src/services/kernelPlatformService.test.ts`

The immediate runtime error was:

- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@sdkwork/core-pc-react'`

## Root Cause

`scripts/ts-extension-loader.mjs` had two resolution strategies:

1. local workspace packages under `packages/`
2. a narrow shared-SDK source alias list:
   - `retired generic app SDK package`
   - `@sdkwork/sdk-common`

That loader did not model sibling workspace packages such as:

- `@sdkwork/core-pc-react`

This was inconsistent with the Vite-side resolver, which already knew how to
map:

- `@sdkwork/core-pc-react`
- `@sdkwork/core-pc-react/app`
- `@sdkwork/core-pc-react/env`
- `@sdkwork/core-pc-react/runtime`

As a result, the regression harness was weaker than the actual app/runtime
integration topology and produced false-negative infrastructure failures.

## Implementation

### 1. Added a failing regression first

Extended `scripts/ts-extension-loader.test.mjs` to assert that the loader must
resolve:

- `@sdkwork/core-pc-react`
- `@sdkwork/core-pc-react/app`

The test failed first with:

- actual: `null`
- expected: sibling workspace source entry

### 2. Hardened the Node loader for sibling workspace package aliases

Extended `scripts/ts-extension-loader.mjs` with explicit sibling workspace
package source specs for `@sdkwork/core-pc-react`.

The loader now resolves the package root and all exported source subpaths used
by Claw Studio:

- `.`
- `./app`
- `./env`
- `./hooks`
- `./im`
- `./preferences`
- `./runtime`

### 3. Preserved the existing resolution order

The fix stayed minimal:

1. shared SDK source aliases still resolve first
2. sibling workspace aliases are added without changing local `@sdkwork/clawstudio-*`
   resolution semantics
3. local relative fallback behavior remains unchanged

## Verification

Verified in this iteration:

- `node scripts/ts-extension-loader.test.mjs`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-settings/src/services/localAiProxyLogsService.test.ts','packages/sdkwork-clawstudio-core/src/services/kernelPlatformService.test.ts']))"`
- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostRuntimeResolver.test.ts packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`

All passed on 2026-04-06.

## Result

This iteration removed a false blocker from the regression pipeline:

- loader-backed Node TypeScript checks can now execute real cross-package logic
  instead of failing during module resolution
- local AI proxy log tests and kernel platform tests are unblocked
- desktop hosted runtime/bootstrap regression checks still pass after the loader
  hardening

## Remaining Risk

The loader now matches the currently used sibling workspace package, but the
mapping is still explicit rather than fully generated from a shared source of
truth.

That is acceptable for this iteration because:

- only `@sdkwork/core-pc-react` is currently imported from the workspace source
  graph outside `packages/`
- the change is intentionally narrow to avoid destabilizing the broader test
  harness

## Next Iteration

Recommended next step:

1. use the unblocked test harness to validate desktop chat/bootstrap into the
   built-in OpenClaw gateway path
2. verify token-accounting fields remain visible through renderer, kernel, and
   hosted runtime surfaces
3. continue the broader review of shared Rust host behavior across
   desktop/server/docker/k8s deployment modes

