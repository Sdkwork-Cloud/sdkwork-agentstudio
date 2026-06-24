# 99-2026-04-08 Runtime Barrels And Package Root Export Surface

## Decision

Runtime barrels that are imported by live feature pages must export runtime surfaces only. Package root `src/index.ts` files must explicitly publish every page, component, runtime helper, or store that the shell consumes through the package root.

Current concrete applications of this rule:

- `packages/sdkwork-claw-instances/src/services/index.ts` must not re-export `.test` or `*Core` modules.
- `packages/sdkwork-claw-auth/src/index.ts` must publish `AuthPage` and `AuthOAuthCallbackPage`.
- `packages/sdkwork-claw-center/src/index.ts` must publish `ClawCenter`, `ClawDetail`, and `ClawUpload`.
- `packages/sdkwork-claw-points/src/index.ts` must publish `PointsHeaderEntry`.
- `packages/sdkwork-claw-chat/src/index.ts` must publish `OpenClawGatewayConnections` and `useChatStore`.

## Why

- `sdkwork-claw-instances` pages and components import `../services`, so `src/services/index.ts` is a live runtime barrel, not a test-only convenience file.
- Before this writeback, that barrel re-exported `.test` modules and `*Core` modules alongside runtime wrappers. The `*Core` exports produced duplicate symbols, and the `.test` re-exports created an unsafe runtime surface.
- The shell already follows the repository rule of consuming feature packages from package roots. When root indexes omitted the required pages, components, and runtime helpers, the shell failed to compile even though the consuming pattern itself was correct.
- `sdkwork-claw-tasks` is currently a thin wrapper around the core `taskService` singleton. Reintroducing a hidden injected factory just to satisfy stale tests would create a fake package contract that the runtime does not actually expose.

## Standard

- `src/services/index.ts` files that are imported by runtime code may re-export runtime services, presentations, and public types only.
- Do not re-export `.test` modules from runtime barrels.
- Do not re-export `*Core` modules from runtime barrels when a runtime wrapper module already re-exports the supported public surface.
- Package root `src/index.ts` files must explicitly export every shell-consumed page, component, runtime helper, and store. Shell consumers should not work around missing root exports with package-internal subpath imports.
- Thin wrapper packages should test and document their actual wrapper contract, not legacy internal factories that are no longer part of the package surface.

## Impact

- `sdkwork-claw-instances` runtime imports no longer depend on test or `*Core` re-export drift.
- The shell can continue consuming auth, center, points, and chat features through package roots without violating repository import-boundary rules.
- `sdkwork-claw-tasks` now remains aligned with its current wrapper design: package consumers get the core `taskService` singleton surface, and package tests verify that explicit contract.
