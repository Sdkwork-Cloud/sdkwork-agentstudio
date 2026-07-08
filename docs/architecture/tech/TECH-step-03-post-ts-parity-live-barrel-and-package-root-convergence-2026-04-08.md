> Migrated from `docs/review/step-03-post-ts-parity-live-barrel-and-package-root-convergence-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued after the earlier TypeScript frontier was removed and exposed a new parity layer of package-root, live-barrel, and Node-safe contract drift.
- This loop kept the production web build green while advancing the workspace lint frontier through `core`, `auth`, `settings`, `agent`, `chat`, `dashboard`, and `devices` to the next remaining `instances` package contract.

## Attempt Outcome

- Full `pnpm.cmd lint` no longer failed on TypeScript diagnostics first. It advanced into package contract checks and surfaced a chain of narrow parity regressions:
  - `packages/sdkwork-clawstudio-core/src/services/communityService.ts`
  - `packages/sdkwork-clawstudio-core/src/services/dashboardCommerceService.ts`
  - `packages/sdkwork-clawstudio-core/src/services/node/index.ts`
  - `packages/sdkwork-clawstudio-auth/src/index.ts`
  - `packages/sdkwork-clawstudio-settings/src/index.ts`
  - `packages/sdkwork-clawstudio-agent/src/services/index.ts`
  - `packages/sdkwork-clawstudio-chat/src/index.ts`
  - `packages/sdkwork-clawstudio-chat/src/services/index.ts`
  - `packages/sdkwork-clawstudio-dashboard/src/index.ts`
  - `packages/sdkwork-clawstudio-dashboard/src/services/index.ts`
  - `packages/sdkwork-clawstudio-devices/package.json`
- Root cause split across three recurring patterns:
  - browser-only shared app-SDK wrappers in `@sdkwork/clawstudio-core` had been drifted into lazy imports and republished through the Node-safe root
  - package roots were using broad `export *` forwarding even where parity scripts explicitly freeze symbol-bearing root exports
  - live runtime barrels still re-exported `.test` modules or non-runtime-safe symbols even though pages consume those barrels directly
- Implemented the narrow repairs:
  - restored static browser-root app-SDK helper imports for `communityService.ts` and `dashboardCommerceService.ts`
  - removed `communityService` and `dashboardCommerceService` from `packages/sdkwork-clawstudio-core/src/services/node/index.ts`
  - explicitly exported auth runtime config helpers from `packages/sdkwork-clawstudio-auth/src/index.ts`
  - changed `packages/sdkwork-clawstudio-settings/src/index.ts` to publish `HostRuntimeSettings.ts` with the explicit path expected by the contract test
  - converted `sdkwork-clawstudio-agent`, `sdkwork-clawstudio-chat`, and `sdkwork-clawstudio-dashboard` service barrels back to runtime-only surfaces and added explicit root-level service exports where required
  - added the missing `@sdkwork/clawstudio-types` dependency declaration to `packages/sdkwork-clawstudio-devices/package.json`
- Current frontier after this loop:
  - `pnpm.cmd lint` now advances to `scripts/sdkwork-instances-contract.test.ts`
  - the next remaining blocker is `packages/sdkwork-clawstudio-instances/package.json` missing the `@monaco-editor/react` dependency expected by the IDE-style workbench contract

## Change Scope

- `packages/sdkwork-clawstudio-core/src/services/communityService.ts`
- `packages/sdkwork-clawstudio-core/src/services/dashboardCommerceService.ts`
- `packages/sdkwork-clawstudio-core/src/services/node/index.ts`
- `packages/sdkwork-clawstudio-auth/src/index.ts`
- `packages/sdkwork-clawstudio-settings/src/index.ts`
- `packages/sdkwork-clawstudio-agent/src/services/index.ts`
- `packages/sdkwork-clawstudio-chat/src/index.ts`
- `packages/sdkwork-clawstudio-chat/src/services/index.ts`
- `packages/sdkwork-clawstudio-dashboard/src/index.ts`
- `packages/sdkwork-clawstudio-dashboard/src/services/index.ts`
- `packages/sdkwork-clawstudio-devices/package.json`
- `docs/架构/100-2026-04-08-browser-root-wrappers-and-runtime-safe-live-barrels.md`
- `docs/review/step-03-post-ts-parity-live-barrel-and-package-root-convergence-2026-04-08.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-15.md`
- `docs/release/releases.json`

## Verification Focus

- `pnpm.cmd check:sdkwork-core`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-core/src/services/communityService.test.ts','packages/sdkwork-clawstudio-core/src/services/dashboardCommerceService.test.ts']))"`
- `pnpm.cmd check:sdkwork-auth`
- `pnpm.cmd check:sdkwork-settings`
- `pnpm.cmd check:sdkwork-agent`
- `pnpm.cmd check:sdkwork-chat`
- `pnpm.cmd check:sdkwork-dashboard`
- `pnpm.cmd check:sdkwork-devices`
- `pnpm.cmd build`
- `pnpm.cmd lint`

## Risks And Rollback

- The repaired files are package-surface and barrel-boundary changes, so the main risk is export-surface regression rather than business logic regression.
- `pnpm.cmd build` is green, but the workspace is not yet lint-clean because the remaining `sdkwork-clawstudio-instances` package contract still blocks the full parity chain.
- Rollback is limited to the listed package-root and barrel files plus the corresponding review, architecture, and release writebacks.

