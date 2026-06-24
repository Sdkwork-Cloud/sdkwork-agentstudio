# 101-2026-04-08 Package Root String Contracts And Owned Runtime Dependencies

## Decision

When a package contract is enforced by raw source inspection, the package root must publish the exact file-bearing exports that the contract freezes, and feature packages must declare the runtime dependencies they actually own in their own `package.json`.

Current concrete applications of this rule:

- `packages/sdkwork-claw-settings/src/index.ts` explicitly publishes `KernelCenter.ts` and `ProviderConfigCenter.ts` through the exact contract-frozen paths.
- `packages/sdkwork-claw-instances/src/index.ts` explicitly publishes `./pages/Nodes.tsx` for the shell route contract.
- `packages/sdkwork-claw-tasks/src/index.ts` explicitly publishes `./components/GlobalTaskManager`, `./services/taskService`, and `./store/useTaskStore`.
- `packages/sdkwork-claw-instances/package.json` declares `@monaco-editor/react` and `monaco-editor` because the instances workbench lazily loads Monaco at runtime.

## Why

- The latest parity layer validates more than effective runtime reachability. Several scripts inspect the literal root source and package manifest text.
- Wrapper files and broad barrels can keep the app working while still drifting away from the frozen contract evidence that shell, parity, and feature-surface checks depend on.
- Lockfile-only presence is not package ownership. If a feature package renders or lazily imports a runtime dependency, that dependency must remain declared at the owning package root.

## Standard

- If a contract test expects an explicit root export path, publish that exact path from `src/index.ts`.
- Do not assume that an equivalent wrapper module or a deeper barrel satisfies a source-string contract.
- If a feature package imports or lazily imports a browser runtime dependency, keep that dependency declared in the feature package manifest.
- Preserve truthful package ownership: manifest declarations, root exports, and runtime imports must agree.

## Impact

- `settings`, `instances`, and `tasks` now expose package-root surfaces that match their script-enforced shell and parity contracts.
- `sdkwork-claw-instances` again owns the Monaco editor dependency required by its IDE-style workbench.
- The workspace parity chain can advance beyond package-root string-contract drift and focus on the remaining Step 03 runtime and release evidence work.
