# Claw Studio V5 Web + Tauri Migration Audit

## Goal

Use `upgrade/claw-studio-v5` as the functional baseline while retaining the current workspace host architecture:

- `@sdkwork/claw-web` stays the web host
- `@sdkwork/claw-desktop` stays the Tauri host
- `@sdkwork/claw-shell` remains the composition layer
- `@sdkwork/claw-core`, `@sdkwork/claw-types`, `@sdkwork/claw-infrastructure`, `@sdkwork/claw-i18n`, and `@sdkwork/claw-ui` remain the shared layers defined by the repository guidelines

## Constraint Review

The existing `docs/plans/2026-03-14-claw-studio-v5-standard-foundation-*.md` documents assume a different target:

- root-level V5 app composition
- removal of the retained dual-host shell packages
- removal of the shared workspace layers that now back the active product

That target conflicts with the repository guidelines in `AGENTS.md`, which require the current workspace layering and thin `web`/`desktop` entry packages.

## Current Migration Status

### Functional baseline

The workspace now exposes the expected V5 product surface inside the retained dual-host architecture.

The previously missing V5 routes are now present in the current route and shell layer:

- `/auth`
- `/claw-upload`

### Runtime health

The initial audit found two runnable-state blockers:

- the web lint step failed because shared packages used `import.meta.env` without a shared Vite type declaration
- the build step was blocked by a local Rollup optional dependency issue in the current environment

Both blockers have now been resolved in the retained workspace architecture:

- shared TypeScript config now exposes `vite/client` types to workspace packages
- workspace dependencies were reinstalled successfully, restoring the missing Rollup platform package
- `pnpm lint` passes
- `pnpm build` passes
- `pnpm check:desktop` passes

## Module Triage

### Keep

These packages are part of the required host architecture and are not removable during the V5 migration:

- `packages/sdkwork-claw-web`
- `packages/sdkwork-claw-desktop`
- `packages/sdkwork-claw-shell`
- `packages/sdkwork-claw-core`
- `packages/sdkwork-claw-types`
- `packages/sdkwork-claw-infrastructure`
- `packages/sdkwork-claw-i18n`
- `packages/sdkwork-claw-ui`
- `packages/sdkwork-claw-distribution`

### Remove Or Decouple From Main Workspace

These packages are not part of the Claw Studio migration target and should not stay inside the main workspace execution path:

- `packages/cc-switch`

### Remove Only After Replacement And Verification

The old `claw-studio-*` package graph has already been removed from the active workspace. The migration focus is now on keeping the `sdkwork-claw-*` graph aligned with V5 through contracts, docs, and runtime verification.

## Immediate Actions

1. Keep parity and host checks green as the executable migration baseline.
2. Keep public documentation aligned with the active `sdkwork-claw-*` package graph and the V5 baseline.
3. Continue feature-level verification against the retained `web + desktop + shell + core + infrastructure` architecture, not against the abandoned root-app replacement plan.
