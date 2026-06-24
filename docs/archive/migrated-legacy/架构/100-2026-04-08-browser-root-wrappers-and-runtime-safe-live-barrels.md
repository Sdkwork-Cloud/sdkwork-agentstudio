# 100-2026-04-08 Browser Root Wrappers And Runtime-Safe Live Barrels

## Decision

Browser-only shared app-SDK wrappers must stay on the browser root of `@sdkwork/claw-core`, and live runtime barrels must export runtime-safe surfaces only. Package roots that are part of the parity contract must explicitly publish the required services or runtime helpers instead of relying on broad forwarding alone.

Current concrete applications of this rule:

- `packages/sdkwork-claw-core/src/services/communityService.ts` and `packages/sdkwork-claw-core/src/services/dashboardCommerceService.ts` stay browser-root wrappers and must not be republished through `packages/sdkwork-claw-core/src/services/node/index.ts`.
- `packages/sdkwork-claw-auth/src/index.ts` explicitly publishes `setAuthRuntimeConfig`, `getAuthRuntimeConfig`, `clearAuthRuntimeConfig`, and `AuthRuntimeConfig`.
- `packages/sdkwork-claw-settings/src/index.ts` explicitly publishes `HostRuntimeSettings.ts` through the contract-frozen path.
- `packages/sdkwork-claw-agent/src/services/index.ts`, `packages/sdkwork-claw-chat/src/services/index.ts`, and `packages/sdkwork-claw-dashboard/src/services/index.ts` are live runtime barrels and therefore do not re-export `.test` modules.
- `packages/sdkwork-claw-chat/src/index.ts` and `packages/sdkwork-claw-dashboard/src/index.ts` explicitly publish the service surfaces that their package contracts freeze at the root.

## Why

- The latest parity layer validates the published package surface, not just implementation behavior. Broad `export *` forwarding can leave the runtime working while still drifting away from the frozen contract surface.
- Moving browser-bound wrappers behind lazy imports and then publishing them from the Node-safe root masks a boundary mistake instead of fixing it. The Node root should only claim services that are actually supported in that execution mode.
- When pages import `../services`, that barrel becomes a live runtime entry. Re-exporting `.test` modules or browser-only helpers through it creates an unsafe surface and keeps producing preventable parity regressions.

## Standard

- Keep browser-root app-SDK wrappers browser-root. Do not repair those wrappers by adding them to the Node-safe root.
- When a contract script freezes root-level exports, publish the required service or helper explicitly from `src/index.ts`.
- Live service barrels may export runtime services, presentations, pure helpers, and public types only.
- Do not re-export `.test` modules from live runtime barrels.
- Do not re-export browser-only or non-Node-safe services from barrels that are intended to stay Node-safe for strip-types verification.

## Impact

- `@sdkwork/claw-core` keeps a truthful split between browser-root wrappers and the Node-safe default root.
- `auth`, `settings`, `agent`, `chat`, and `dashboard` package roots now align better with their script-enforced public contracts.
- The workspace lint frontier now advances beyond those package-surface regressions and is free to expose the next remaining `sdkwork-claw-instances` IDE-workbench dependency gap.
