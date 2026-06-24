> Migrated from `docs/review/step-03-instances-shell-tasks-package-contract-closure-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued from the `sdkwork-claw-instances` IDE-workbench dependency frontier into the next shell and tasks package-root contract layer.
- This loop closed the remaining package-surface parity blockers and moved fresh workspace `lint` and production `build` back to green, while Step 03 itself remains open on the broader runtime/release evidence chain.

## Attempt Outcome

- Full `pnpm.cmd lint` first failed in `scripts/sdkwork-instances-contract.test.ts`, then advanced through `scripts/sdkwork-shell-contract.test.ts`, and finally through `scripts/sdkwork-tasks-contract.test.ts`.
- Root cause converged on two script-enforced contract rules:
  - runtime-owning feature packages must declare their own runtime dependencies in `package.json`, even if `pnpm-lock.yaml` still retains the importer entry
  - package-root contract scripts inspect raw source strings, so explicit file-bearing exports matter even when wrapper modules or indirect barrels keep runtime behavior working
- Implemented the narrow repairs:
  - restored `@monaco-editor/react` and `monaco-editor` to `packages/sdkwork-claw-instances/package.json` so the IDE-style workbench owns its Monaco runtime explicitly again
  - changed `packages/sdkwork-claw-settings/src/index.ts` to publish `KernelCenter.ts` and `ProviderConfigCenter.ts` through the exact contract-frozen paths
  - changed `packages/sdkwork-claw-instances/src/index.ts` to publish `./pages/Nodes.tsx` explicitly for the shell route contract
  - changed `packages/sdkwork-claw-tasks/src/index.ts` to publish `GlobalTaskManager`, `taskService`, and `useTaskStore` from the package root instead of relying on indirect reachability
- Current status after this loop:
  - `pnpm.cmd lint` is fresh green through parity and automation
  - `pnpm.cmd build` is fresh green
  - Step 03 no longer has a package-surface parity blocker at the top of the stack
  - the remaining Step 03 gap is the wider upgrade/rollback, runtime-hotspot, and release-smoke evidence chain

## Change Scope

- `packages/sdkwork-claw-instances/package.json`
- `packages/sdkwork-claw-settings/src/index.ts`
- `packages/sdkwork-claw-instances/src/index.ts`
- `packages/sdkwork-claw-tasks/src/index.ts`
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

- The repaired files are package-root manifest and export-surface changes, so the main regression risk is contract drift rather than runtime business logic.
- `pnpm.cmd build` still prints existing browser-externalized warnings for test files that are imported into the web bundle graph; they did not fail the build in this loop and were not introduced by these repairs.
- Rollback is limited to the listed package-root files and the corresponding review, architecture, and release writebacks.

