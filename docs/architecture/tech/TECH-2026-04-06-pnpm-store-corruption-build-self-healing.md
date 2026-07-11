> Migrated from `docs/review/2026-04-06-pnpm-store-corruption-build-self-healing.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 PNPM's Store Corruption And Cross-Workspace Build Self-Healing

## Scope

This iteration focused on restoring a reliable local production build for `@sdkwork/agentstudio-pc-web` under the current constrained environment:

- Windows host
- `approval_policy=never`
- write access limited to `apps/agent-studio`
- broken local `.pnpm` content and fallback links
- external workspace packages being consumed through live source aliases

The immediate goal was not feature delivery. The goal was to make the build and local runtime foundation trustworthy again so later OpenClaw, desktop host, chat, and deployment work can be validated on a stable base.

## Root Causes Found

### 1. `repair-pnpm-store-files` re-scanned stale backup package directories

The repair flow created `.bak-*` package directories when a package root had to be rebuilt, but the package-root scanner did not exclude those backup directories on later passes.

That caused two cascading problems:

- backup package roots were treated as live packages
- every new repair pass appended another `.bak-*` suffix layer

On Windows this eventually surfaced as `copyfile EPERM` failures against paths such as:

- `@babel/helper-compilation-targets.bak-...README.md`

This was a real root-cause bug in the repair algorithm, not a transient filesystem glitch.

### 2. Workspace alias priority was wrong for `@sdkwork/core-pc-react/*`

`resolveWorkspacePackageAliases()` returned aliases sorted alphabetically. That put:

- `@sdkwork/core-pc-react`

before:

- `@sdkwork/core-pc-react/app`
- `@sdkwork/core-pc-react/env`
- `@sdkwork/core-pc-react/runtime`

Vite then matched the root alias first and incorrectly produced paths like:

- `src/index.ts/app`
- `src/index.ts/env`
- `src/index.ts/runtime`

This was the direct cause of the earlier build failure after the environment-level corruption had been reduced.

### 3. `repair-pnpm-fallback-links` only handled exact dependency versions

The fallback materialization logic extracted a single version token from dependency specifiers and looked for an exact metadata key in the global pnpm store.

That worked for exact versions like:

- `0.2.15`

but failed for semver ranges like:

- `^2.0.0`

because the global store commonly held the real resolved version, for example:

- `comma-separated-tokens@2.0.3`

As a result, transitive packages that existed in the global store were not materialized into the local workspace, and Vite later failed on unresolved bare imports.

### 4. Cross-workspace runtime dependencies were drifting into sibling workspace `node_modules`

Even after the local workspace had enough packages, Rolldown still resolved some browser runtime dependencies from external workspace copies, especially on IM and markdown/runtime chains.

This produced failures like:

- `base64-js`
- `ieee754`
- `bignumber.js`

The package data already existed in the current workspace root, but resolution kept following external workspace-private dependency trees instead of the current host workspace.

## Changes Landed

### 1. Ignore backup package directories during pnpm store health scans

File:

- `scripts/repair-pnpm-store-files.mjs`

Change:

- package root enumeration now ignores any package directory whose name contains `.bak-`
- this applies to both scoped and unscoped packages

Impact:

- repair passes no longer recurse into stale backup directories
- backup-name growth stops
- Windows copy failures caused by recursive backup reprocessing stop

### 2. Added a regression test for backup directory pollution

File:

- `scripts/repair-pnpm-store-files.test.mjs`

Coverage:

- verifies a stale scoped backup package directory is ignored
- verifies no false damaged package is reported
- verifies no restore is attempted for the stale backup root

### 3. Changed workspace alias sorting to prefer more specific paths

File:

- `scripts/viteWorkspaceResolver.ts`

Change:

- aliases are now sorted by `find.length` descending first
- lexical ordering is only used as a stable tie-breaker

Impact:

- `@sdkwork/core-pc-react/app`
- `@sdkwork/core-pc-react/env`
- `@sdkwork/core-pc-react/runtime`

now win before the root alias and resolve to the correct source entries.

### 4. Added alias-order regression coverage

File:

- `packages/sdkwork-agentstudio-pc-web/viteWorkspaceResolver.test.ts`

Coverage:

- verifies the subpath aliases exist
- verifies the subpath aliases appear before the root alias

### 5. Added semver-range aware global store materialization

File:

- `scripts/repair-pnpm-fallback-links.mjs`

Changes:

- dependency requests now retain the original specifier
- global store metadata is indexed by both `name@version` and `name`
- materialization now chooses the best metadata entry for:
  - exact versions
  - caret ranges
  - tilde ranges

Impact:

- packages such as `comma-separated-tokens@2.0.3` can now be materialized for a dependency request like `^2.0.0`
- transitive dependency repair is much closer to the actual resolved package graph instead of only exact pins

### 6. Added semver-range regression coverage

File:

- `scripts/repair-pnpm-fallback-links.test.mjs`

Coverage:

- verifies a dependency declared as `^2.0.0` can materialize `2.0.3` from the global store

### 7. Hardened shared Vite dedupe for browser runtime dependencies that already exist in the current workspace

File:

- `scripts/viteBuildOptimization.ts`

New shared dedupe set includes:

- `buffer`
- `base64-js`
- `ieee754`
- `wukongimjssdk`
- `bignumber.js`
- `crypto-js`
- `curve25519-js`
- `md5-typescript`

Impact:

- when external workspace packages are pulled into the current build graph, these runtime dependencies resolve to the current workspace copy instead of drifting into sibling workspace-private resolution paths

### 8. Added shared dedupe contract coverage

File:

- `packages/sdkwork-agentstudio-pc-desktop/viteBuildOptimization.test.ts`

Coverage:

- verifies the shared dedupe list contains the cross-workspace runtime packages required by the current build graph

## Verification Evidence

The following commands passed after the fixes landed:

- `node scripts/repair-pnpm-store-files.test.mjs`
- `node scripts/repair-pnpm-fallback-links.test.mjs`
- `node scripts/run-vite-host.test.mjs`
- `node --experimental-transform-types packages/sdkwork-agentstudio-pc-web/viteWorkspaceResolver.test.ts`
- `node --experimental-transform-types packages/sdkwork-agentstudio-pc-desktop/viteBuildOptimization.test.ts`
- `node scripts/sdkwork-core-contract.test.ts`
- `node scripts/sdkwork-foundation-contract.test.ts`
- `pnpm.cmd --filter @sdkwork/agentstudio-pc-web build`

The final `@sdkwork/agentstudio-pc-web` production build completed successfully on April 6, 2026.

## Current State After This Iteration

The build has moved from:

- corrupted local `.pnpm` contents
- missing hoisted and root fallback links
- broken workspace alias priority
- unresolved transitive packages from global store
- cross-workspace browser runtime dependency drift

to:

- reproducible repair tests
- reproducible workspace alias tests
- reproducible build optimization tests
- successful `@sdkwork/agentstudio-pc-web` production build

This is a meaningful foundation milestone because later application-level debugging can now happen on top of a working local build path instead of a permanently damaged toolchain state.

## Remaining Gaps

### 1. The fallback materializer still only supports simple semver selectors

The new selector logic supports:

- exact
- `^`
- `~`

It does not yet support more complex range expressions such as:

- comparator chains
- unions
- prerelease-heavy ranges

If later packages use more complex dependency syntax, the materializer may still under-repair them.

### 2. Cross-workspace dependency correction is still policy-based, not fully generic

The current mitigation uses a shared dedupe allowlist for known runtime packages. That is effective for the current graph, but it is still an allowlist.

A more complete long-term solution would be a workspace-aware bare-import resolver that prefers the current host workspace copy for external workspace runtime dependencies whenever that package already exists locally.

### 3. This iteration verified the web production build, not the full desktop/server release matrix

The build foundation is now healthier, but this iteration did not yet re-run:

- packaged desktop first-launch smoke
- OpenClaw bundled runtime startup smoke
- server/docker/k8s shared-host runtime smoke

Those remain mandatory in later iterations.

## Recommended Next Steps

1. Add a generic external-workspace bare dependency resolver for Vite so cross-workspace runtime drift does not require a growing dedupe list.
2. Extend the fallback materializer to support a broader semver range subset before more external workspace packages are brought into the graph.
3. Re-run desktop hosted runtime and built-in OpenClaw smoke on top of this repaired build foundation.
4. Continue documenting each closed-loop iteration in `docs/review/` so environment, runtime, and application-level defects stay separated and traceable.

