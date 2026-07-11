# 2026-04-06 Agent Studio Dependency Audit And Upgrade

## Scope

This pass only updates direct dependency declarations that were confirmed behind the latest npm registry release during the live audit for the `apps/agent-studio` workspace.

The user explicitly requested no install step in this pass, so this change set intentionally does not refresh `pnpm-lock.yaml`.

## Audit Result

The workspace audit found that the current direct dependency declarations were already current for the main platform stack:

- `react`
- `react-dom`
- `vite`
- `typescript`
- `tailwindcss`
- `@tauri-apps/*`
- `zustand`
- `@radix-ui/*`

The only direct dependencies behind the latest registry release were:

1. `@tiptap/*`
   - From `3.22.1`
   - To `3.22.2`
   - Risk level: low
   - Reason: same-major patch upgrade in a single feature package

2. `fuse.js`
   - From `7.2.0`
   - To `7.3.0`
   - Risk level: low
   - Reason: same-major minor upgrade with unchanged package usage pattern in the workspace

## Updated Files

- `packages/sdkwork-agentstudio-pc-community/package.json`
  - `@tiptap/extension-highlight` -> `^3.22.2`
  - `@tiptap/extension-image` -> `^3.22.2`
  - `@tiptap/extension-link` -> `^3.22.2`
  - `@tiptap/extension-placeholder` -> `^3.22.2`
  - `@tiptap/extension-task-item` -> `^3.22.2`
  - `@tiptap/extension-task-list` -> `^3.22.2`
  - `@tiptap/react` -> `^3.22.2`
  - `@tiptap/starter-kit` -> `^3.22.2`

- `packages/sdkwork-agentstudio-pc-core/package.json`
  - `fuse.js` -> `^7.3.0`

- `packages/sdkwork-agentstudio-pc-github/package.json`
  - `fuse.js` -> `^7.3.0`

- `packages/sdkwork-agentstudio-pc-huggingface/package.json`
  - `fuse.js` -> `^7.3.0`

- `packages/sdkwork-agentstudio-pc-market/package.json`
  - `fuse.js` -> `^7.3.0`

- `packages/sdkwork-agentstudio-pc-shell/package.json`
  - `fuse.js` -> `^7.3.0`

## Compatibility Assessment

### `@tiptap/*` from `3.22.1` to `3.22.2`

- Same major and patch-level uplift.
- Current package usage is editor integration, not custom extension internals.
- No code changes were required around API signatures in this pass.
- Expected compatibility risk is low.

### `fuse.js` from `7.2.0` to `7.3.0`

- Same major version family.
- Current workspace usage is standard list filtering and fuzzy matching.
- No custom transport, plugin, or monkey-patch behavior depends on undocumented Fuse internals.
- Expected compatibility risk is low.

## Lockfile Handling

- `pnpm-lock.yaml` was not refreshed in this pass.
- A temporary dirty state appeared after an interrupted package-management attempt.
- The file content was verified and the false-dirty worktree state was cleared without modifying lockfile contents.

## Follow-Up

When the user is ready to apply the dependency graph locally, the next manual step is:

1. Run workspace install or lockfile refresh manually.
2. Run workspace verification commands after install:
   - `pnpm lint`
   - `pnpm build`
   - `pnpm check:desktop`
3. If any resolved transitive changes affect editor or fuzzy-search behavior, capture them in a dedicated regression note under `docs/review/`.
