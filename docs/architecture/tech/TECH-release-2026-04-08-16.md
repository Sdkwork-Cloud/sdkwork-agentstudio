> Migrated from `docs/release/release-2026-04-08-16.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued from the remaining `sdkwork-clawstudio-instances` IDE dependency blocker into the next shell and tasks package-root contract layer.
- This release candidate keeps Step 03 open, but it restores fresh green `lint` and `build` evidence by closing the remaining package-surface parity gaps.

## Attempt Outcome

- The loop repaired three linked contract drifts:
  - `sdkwork-clawstudio-instances` had dropped its Monaco runtime ownership from `package.json` even though the instances workbench still lazily imports Monaco
  - `sdkwork-clawstudio-settings` and `sdkwork-clawstudio-instances` package roots were no longer publishing the exact file-bearing exports frozen by shell contract scripts
  - `sdkwork-clawstudio-tasks` package root no longer explicitly exposed `GlobalTaskManager`, `taskService`, and `useTaskStore`
- Implemented the narrow repairs:
  - restored `@monaco-editor/react` and `monaco-editor` to `packages/sdkwork-clawstudio-instances/package.json`
  - changed `packages/sdkwork-clawstudio-settings/src/index.ts` to use explicit `KernelCenter.ts` and `ProviderConfigCenter.ts` root exports
  - changed `packages/sdkwork-clawstudio-instances/src/index.ts` to explicitly export `./pages/Nodes.tsx`
  - changed `packages/sdkwork-clawstudio-tasks/src/index.ts` to explicitly export `./components/GlobalTaskManager`, `./services/taskService`, and `./store/useTaskStore`
- Fresh verification:
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd check:sdkwork-shell`
  - `pnpm.cmd check:sdkwork-tasks`
  - `pnpm.cmd lint`
  - `pnpm.cmd build`

## Change Scope

- `packages/sdkwork-clawstudio-instances/package.json`
- `packages/sdkwork-clawstudio-settings/src/index.ts`
- `packages/sdkwork-clawstudio-instances/src/index.ts`
- `packages/sdkwork-clawstudio-tasks/src/index.ts`
- `docs/review/step-03-instances-shell-tasks-package-contract-closure-2026-04-08.md`
- `docs/架构/101-2026-04-08-package-root-string-contracts-and-owned-runtime-dependencies.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-16.md`
- `docs/release/releases.json`

## Verification Focus

- `pnpm.cmd check:sdkwork-instances`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd check:sdkwork-tasks`
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Risks And Rollback

- The changes are limited to package-root exports and manifest ownership, so the main risk is future contract drift rather than behavior drift.
- Build warnings about browser-externalized `node:assert/strict` imports from test files remain informational in this loop; they did not block the production build.
- Rollback is limited to the listed package-root files and the associated review, architecture, and release writebacks.

