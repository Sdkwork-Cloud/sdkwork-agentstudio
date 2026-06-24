> Migrated from `docs/release/release-2026-04-08-14.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with a workspace contract-convergence iteration that closed the remaining TypeScript lint frontier across OpenClaw bootstrap fixtures, runtime-only barrels, settings/local-AI-proxy tests, shell package-root exports, and thin wrapper packages.
- This release candidate keeps Step 03 open; it removes the current TypeScript blocker stack but does not yet close the broader Step 03 upgrade, rollback, or multi-mode release-smoke evidence.

## Attempt Outcome

- `openClawBootstrapService.test.ts` now forwards the current `StudioPlatformAPI` task/file/provider methods through its studio stub.
- `sdkwork-claw-instances/src/services/index.ts` now exports runtime-only surfaces, and `agentWorkbenchService.test.ts` now keeps `getToolsCatalog(...)` agent ids typed instead of falling back to `unknown`.
- `kernelCenterService.test.ts`, `localAiProxyLogsService.test.ts`, `providerConfigEditorPolicy.test.ts`, `providerConfigImportService.test.ts`, and `settingsService.test.ts` now align with current settings and local-AI-proxy contracts.
- auth, center, points, and chat package roots now publish the shell-facing pages, components, runtime helper, and store surfaces that the shell consumes from package roots.
- `clawMallService.test.ts` now uses full `ClawMallProduct` fixtures, and `taskService.test.ts` now verifies the real thin-wrapper contract of `@sdkwork/claw-tasks`.
- Fresh verification produced a TypeScript-clean `pnpm.cmd lint`.

## Change Scope

- `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- `packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts`
- `packages/sdkwork-claw-instances/src/services/index.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/services/localAiProxyLogsService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigImportService.test.ts`
- `packages/sdkwork-claw-settings/src/services/settingsService.test.ts`
- `packages/sdkwork-claw-auth/src/index.ts`
- `packages/sdkwork-claw-center/src/index.ts`
- `packages/sdkwork-claw-points/src/index.ts`
- `packages/sdkwork-claw-chat/src/index.ts`
- `packages/sdkwork-claw-mall/src/services/clawMallService.test.ts`
- `packages/sdkwork-claw-tasks/src/services/taskService.test.ts`
- `docs/架构/99-2026-04-08-runtime-barrels-and-package-root-export-surface.md`
- `docs/review/step-03-runtime-barrel-root-export-and-wrapper-contract-alignment-2026-04-08.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-14.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/localAiProxyLogsService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigImportService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/settingsService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-mall/src/services/clawMallService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-tasks/src/services/taskService.test.ts`
- `pnpm.cmd lint`

## Risks And Rollback

- The main runtime-surface change is package-boundary alignment:
  - `sdkwork-claw-instances/src/services/index.ts` no longer re-exports runtime-unsafe `.test` and `*Core` modules.
  - auth, center, points, and chat package roots now export additional shell-consumed public surfaces.
- `sdkwork-claw-tasks` now records its real thin-wrapper contract instead of a retired injected factory assumption.
- Rollback is limited to the listed files and this release note set.

