> Migrated from `docs/release/release-2026-04-08-15.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with a post-TypeScript parity-repair loop across `core`, `auth`, `settings`, `agent`, `chat`, `dashboard`, and `devices`.
- This release candidate keeps Step 03 open; it preserves a green production web build while advancing the full workspace lint frontier to the next remaining `instances` package contract blocker.

## Attempt Outcome

- Full `pnpm.cmd lint` moved beyond TypeScript and exposed a package-surface parity chain:
  - browser-root shared app-SDK wrappers in `@sdkwork/agentstudio-pc-core` had drifted into lazy imports and Node-root re-exports
  - `auth`, `settings`, `chat`, and `dashboard` package roots still relied on broad forwarding where contract scripts expected explicit symbol-bearing exports
  - `agent`, `chat`, and `dashboard` live service barrels still re-exported `.test` modules or non-runtime-safe symbols
  - `sdkwork-agentstudio-pc-devices` was missing the `@sdkwork/agentstudio-pc-types` dependency declaration required by its package contract
- The loop repaired those boundary and contract drifts without changing product behavior:
  - restored static browser-root imports in `communityService.ts` and `dashboardCommerceService.ts`
  - removed browser-only wrappers from `packages/sdkwork-agentstudio-pc-core/src/services/node/index.ts`
  - explicitly exported auth runtime config helpers, chat service, and dashboard services from package roots
  - converted the affected service barrels back to runtime-only surfaces
  - added `@sdkwork/agentstudio-pc-types` to `packages/sdkwork-agentstudio-pc-devices/package.json`
- Fresh verification:
  - `pnpm.cmd check:sdkwork-core`
  - `pnpm.cmd check:sdkwork-auth`
  - `pnpm.cmd check:sdkwork-settings`
  - `pnpm.cmd check:sdkwork-agent`
  - `pnpm.cmd check:sdkwork-chat`
  - `pnpm.cmd check:sdkwork-dashboard`
  - `pnpm.cmd check:sdkwork-devices`
  - `pnpm.cmd build`
  - `pnpm.cmd lint` now fails later at `scripts/sdkwork-instances-contract.test.ts`
- Current frontier:
  - `packages/sdkwork-agentstudio-pc-instances/package.json` still lacks the `@monaco-editor/react` dependency expected by the IDE-style files workspace contract

## Change Scope

- `packages/sdkwork-agentstudio-pc-core/src/services/communityService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/services/dashboardCommerceService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/services/node/index.ts`
- `packages/sdkwork-agentstudio-pc-auth/src/index.ts`
- `packages/sdkwork-agentstudio-pc-settings/src/index.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/index.ts`
- `packages/sdkwork-agentstudio-pc-chat/src/index.ts`
- `packages/sdkwork-agentstudio-pc-chat/src/services/index.ts`
- `packages/sdkwork-agentstudio-pc-dashboard/src/index.ts`
- `packages/sdkwork-agentstudio-pc-dashboard/src/services/index.ts`
- `packages/sdkwork-agentstudio-pc-devices/package.json`
- `docs/架构/100-2026-04-08-browser-root-wrappers-and-runtime-safe-live-barrels.md`
- `docs/review/step-03-post-ts-parity-live-barrel-and-package-root-convergence-2026-04-08.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-15.md`
- `docs/release/releases.json`

## Verification Focus

- `pnpm.cmd check:sdkwork-core`
- `pnpm.cmd check:sdkwork-auth`
- `pnpm.cmd check:sdkwork-settings`
- `pnpm.cmd check:sdkwork-agent`
- `pnpm.cmd check:sdkwork-chat`
- `pnpm.cmd check:sdkwork-dashboard`
- `pnpm.cmd check:sdkwork-devices`
- `pnpm.cmd build`
- `pnpm.cmd lint`

## Risks And Rollback

- The main changes are package-surface and barrel-boundary corrections. Runtime behavior risk is lower than package export regression risk.
- Full workspace lint still does not close because the next parity blocker remains in `sdkwork-agentstudio-pc-instances`.
- Rollback is limited to the listed package-root, service-barrel, package-manifest, and documentation files.

