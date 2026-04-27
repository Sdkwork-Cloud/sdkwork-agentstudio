# Claw V5 Dual-Host Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the current workspace to a full `upgrade/claw-studio-v5` product surface while preserving browser and Tauri desktop hosts, renaming the package system to `sdkwork-claw-*` directories and `@sdkwork/claw-*` package names, and extracting a reusable `sdkwork-claw-ui` shared UI foundation.

**Architecture:** Build the new `sdkwork-claw-*` graph alongside the current `claw-studio-*` graph first, using compatibility bridges so web and desktop stay runnable throughout the migration. Re-home durable shared logic into `sdkwork-claw-ui`, `sdkwork-claw-core`, `sdkwork-claw-i18n`, `sdkwork-claw-types`, and `sdkwork-claw-distribution`, then port V5 feature packages, switch both hosts to the new graph, and only then remove obsolete packages.

**Tech Stack:** TypeScript, React, pnpm workspace, Vite, React Router, Zustand, Tauri 2, Rust, Tailwind CSS, shadcn/ui, Radix UI, motion

---

## Current Baseline Notes

- `packages/cc-switch` is already excluded from the main workspace. Preserve that change.
- `tsconfig.base.json` already includes `vite/client` types. Preserve that change.
- `pnpm lint` and `pnpm build` currently pass on the retained `claw-studio-*` host graph. Treat that as the migration safety baseline.
- Do not use the old `2026-03-14-claw-studio-v5-standard-foundation-*` plan as-is. It assumes a root-app replacement model that conflicts with the approved dual-host package architecture.

## File Structure Map

### New host packages

- Create: `packages/sdkwork-claw-web/package.json`
- Create: `packages/sdkwork-claw-web/tsconfig.json`
- Create: `packages/sdkwork-claw-web/index.html`
- Create: `packages/sdkwork-claw-web/server.ts`
- Create: `packages/sdkwork-claw-web/src/main.tsx`
- Create: `packages/sdkwork-claw-web/src/App.tsx`

- Create: `packages/sdkwork-claw-desktop/package.json`
- Create: `packages/sdkwork-claw-desktop/tsconfig.json`
- Create: `packages/sdkwork-claw-desktop/index.html`
- Create: `packages/sdkwork-claw-desktop/vite.config.ts`
- Create: `packages/sdkwork-claw-desktop/src/vite-env.d.ts`
- Create: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/providers/DesktopProviders.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Create: `packages/sdkwork-claw-desktop/src-tauri/*`

### New shared packages

- Create: `packages/sdkwork-claw-shell/*`
- Create: `packages/sdkwork-claw-ui/*`
- Create: `packages/sdkwork-claw-core/*`
- Create: `packages/sdkwork-claw-i18n/*`
- Create: `packages/sdkwork-claw-types/*`
- Create: `packages/sdkwork-claw-distribution/*`

### New feature packages

- Create or replace: `packages/sdkwork-claw-account`
- Create or replace: `packages/sdkwork-claw-apps`
- Create or replace: `packages/sdkwork-claw-auth`
- Create or replace: `packages/sdkwork-claw-center`
- Create or replace: `packages/sdkwork-claw-channels`
- Create or replace: `packages/sdkwork-claw-chat`
- Create or replace: `packages/sdkwork-claw-community`
- Create or replace: `packages/sdkwork-claw-devices`
- Create or replace: `packages/sdkwork-claw-docs`
- Create or replace: `packages/sdkwork-claw-extensions`
- Create or replace: `packages/sdkwork-claw-github`
- Create or replace: `packages/sdkwork-claw-huggingface`
- Create or replace: `packages/removed-install-feature`
- Create or replace: `packages/sdkwork-claw-instances`
- Create or replace: `packages/sdkwork-claw-market`
- Create or replace: `packages/sdkwork-claw-settings`
- Create or replace: `packages/sdkwork-claw-tasks`

### Migration contract and QA files

- Create: `docs/plans/2026-03-15-sdkwork-claw-package-matrix.md`
- Create: `docs/plans/2026-03-15-sdkwork-claw-manual-qa.md`
- Create: `scripts/check-sdkwork-claw-structure.mjs`
- Create: `scripts/check-sdkwork-claw-route-surface.mjs`
- Create: `scripts/check-sdkwork-claw-hosts.mjs`
- Create: `scripts/v5-product-contract.test.ts`

### Existing files to replace or update

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `tsconfig.base.json`
- Modify: `scripts/check-arch-boundaries.mjs`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Modify: `scripts/sync-feature-packages.mjs`
- Modify: `docs/core/packages.md`
- Modify: `docs/zh-CN/core/packages.md`
- Modify: `docs/index.md`
- Modify: `docs/zh-CN/index.md`
- Modify: `docs/features/overview.md`
- Modify: `docs/zh-CN/features/overview.md`

---

## Chunk 1: Freeze The New Migration Contract And Naming Skeleton

### Task 1: Define The `sdkwork-claw-*` Migration Contract

**Files:**
- Create: `docs/plans/2026-03-15-sdkwork-claw-package-matrix.md`
- Create: `scripts/check-sdkwork-claw-structure.mjs`
- Create: `scripts/check-sdkwork-claw-route-surface.mjs`
- Create: `scripts/check-sdkwork-claw-hosts.mjs`
- Create: `scripts/v5-product-contract.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract checks**

Create these scripts with initial assertions:

```js
// scripts/check-sdkwork-claw-structure.mjs
assertPackageDir('packages/sdkwork-claw-web', '@sdkwork/claw-web');
assertPackageDir('packages/sdkwork-claw-desktop', '@sdkwork/claw-desktop');
assertPackageDir('packages/sdkwork-claw-shell', '@sdkwork/claw-shell');
assertPackageDir('packages/sdkwork-claw-ui', '@sdkwork/claw-ui');
assertMissingActivePackage('packages/claw-studio-web');
assertMissingActivePackage('packages/claw-studio-shell');
```

```js
// scripts/check-sdkwork-claw-route-surface.mjs
assertRoute('/auth');
assertRoute('/claw-upload');
assertRoute('/chat');
assertRoute('/market');
```

```js
// scripts/check-sdkwork-claw-hosts.mjs
assertHostDependsOnShell('@sdkwork/claw-web', '@sdkwork/claw-shell');
assertHostDependsOnShell('@sdkwork/claw-desktop', '@sdkwork/claw-shell');
assertFeaturePackagesDoNotImportTauri();
```

```ts
// scripts/v5-product-contract.test.ts
runTest('V5 contract includes auth route and product shell affordances', () => {
  const source = read('upgrade/claw-studio-v5/src/App.tsx');
  assert.match(source, /path="\/auth"/);
  assert.match(source, /path="\/claw-upload"/);
});
```

- [ ] **Step 2: Run the contract checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-structure.mjs`
- `node scripts/check-sdkwork-claw-route-surface.mjs`
- `node scripts/check-sdkwork-claw-hosts.mjs`
- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: FAIL because the new package graph and route surface do not exist yet.

- [ ] **Step 3: Document the package matrix and expose the new verification scripts**

Document:

- every current `claw-studio-*` package
- its `sdkwork-claw-*` successor
- whether it becomes a bridge, a retained host package replacement, or a final deletion target
- the exact final package name `@sdkwork/claw-*`

Add root scripts:

- `check:sdkwork-structure`
- `check:sdkwork-routes`
- `check:sdkwork-hosts`
- `check:v5`

- [ ] **Step 4: Re-run the checks**

Run the same four commands again.

Expected: still FAIL, but now due only to missing package implementation rather than missing scripts.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/2026-03-15-sdkwork-claw-package-matrix.md scripts/check-sdkwork-claw-structure.mjs scripts/check-sdkwork-claw-route-surface.mjs scripts/check-sdkwork-claw-hosts.mjs scripts/v5-product-contract.test.ts package.json
git commit -m "docs: define sdkwork claw migration contract"
```

### Task 2: Create The New Host And Shared Package Skeleton

**Files:**
- Create: `packages/sdkwork-claw-web/package.json`
- Create: `packages/sdkwork-claw-web/tsconfig.json`
- Create: `packages/sdkwork-claw-web/src/index.ts`
- Create: `packages/sdkwork-claw-desktop/package.json`
- Create: `packages/sdkwork-claw-desktop/tsconfig.json`
- Create: `packages/sdkwork-claw-desktop/src/index.ts`
- Create: `packages/sdkwork-claw-shell/package.json`
- Create: `packages/sdkwork-claw-shell/tsconfig.json`
- Create: `packages/sdkwork-claw-shell/src/index.ts`
- Create: `packages/sdkwork-claw-ui/package.json`
- Create: `packages/sdkwork-claw-ui/tsconfig.json`
- Create: `packages/sdkwork-claw-ui/src/index.ts`
- Create: `packages/sdkwork-claw-core/package.json`
- Create: `packages/sdkwork-claw-core/tsconfig.json`
- Create: `packages/sdkwork-claw-core/src/index.ts`
- Create: `packages/sdkwork-claw-i18n/package.json`
- Create: `packages/sdkwork-claw-i18n/tsconfig.json`
- Create: `packages/sdkwork-claw-i18n/src/index.ts`
- Create: `packages/sdkwork-claw-types/package.json`
- Create: `packages/sdkwork-claw-types/tsconfig.json`
- Create: `packages/sdkwork-claw-types/src/index.ts`
- Create: `packages/sdkwork-claw-distribution/package.json`
- Create: `packages/sdkwork-claw-distribution/tsconfig.json`
- Create: `packages/sdkwork-claw-distribution/src/index.ts`

- [ ] **Step 1: Extend the failing structure check for package names**

Add assertions such as:

```js
assertPackageName('packages/sdkwork-claw-web/package.json', '@sdkwork/claw-web');
assertPackageName('packages/sdkwork-claw-shell/package.json', '@sdkwork/claw-shell');
assertPackageName('packages/sdkwork-claw-ui/package.json', '@sdkwork/claw-ui');
```

- [ ] **Step 2: Run the structure check to verify it fails**

Run: `node scripts/check-sdkwork-claw-structure.mjs`

Expected: FAIL because none of the new shared packages exist yet.

- [ ] **Step 3: Create minimal bridge packages**

For each new package:

- create a valid `package.json`
- create `tsconfig.json`
- create `src/index.ts`

Bridge behavior for the first pass:

- `sdkwork-claw-shell` re-exports from `@sdkwork/claw-studio-shell`
- `sdkwork-claw-ui` re-exports from `@sdkwork/claw-studio-shared-ui`
- `sdkwork-claw-core` re-exports from `@sdkwork/claw-studio-business`
- `sdkwork-claw-i18n` re-exports the infrastructure i18n entry
- `sdkwork-claw-types` re-exports from `@sdkwork/claw-studio-domain`
- `sdkwork-claw-distribution` re-exports from `@sdkwork/claw-studio-distribution`

- [ ] **Step 4: Re-run the structure check**

Run: `node scripts/check-sdkwork-claw-structure.mjs`

Expected: PASS for the new host/shared skeleton existence assertions while old-package cleanup assertions still fail later.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-web packages/sdkwork-claw-desktop packages/sdkwork-claw-shell packages/sdkwork-claw-ui packages/sdkwork-claw-core packages/sdkwork-claw-i18n packages/sdkwork-claw-types packages/sdkwork-claw-distribution scripts/check-sdkwork-claw-structure.mjs
git commit -m "feat: add sdkwork claw host and shared package skeleton"
```

### Task 3: Create The New Feature Package Skeleton

**Files:**
- Create: `packages/sdkwork-claw-account/*`
- Create: `packages/sdkwork-claw-apps/*`
- Create: `packages/sdkwork-claw-auth/*`
- Create: `packages/sdkwork-claw-center/*`
- Create: `packages/sdkwork-claw-channels/*`
- Create: `packages/sdkwork-claw-chat/*`
- Create: `packages/sdkwork-claw-community/*`
- Create: `packages/sdkwork-claw-devices/*`
- Create: `packages/sdkwork-claw-docs/*`
- Create: `packages/sdkwork-claw-extensions/*`
- Create: `packages/sdkwork-claw-github/*`
- Create: `packages/sdkwork-claw-huggingface/*`
- Create: `packages/removed-install-feature/*`
- Create: `packages/sdkwork-claw-instances/*`
- Create: `packages/sdkwork-claw-market/*`
- Create: `packages/sdkwork-claw-settings/*`
- Create: `packages/sdkwork-claw-tasks/*`

- [ ] **Step 1: Extend the structure check for all V5 feature packages**

Add checks such as:

```js
assertPackageDir('packages/sdkwork-claw-chat', '@sdkwork/claw-chat');
assertPackageDir('packages/sdkwork-claw-market', '@sdkwork/claw-market');
assertPackageDir('packages/sdkwork-claw-auth', '@sdkwork/claw-auth');
```

- [ ] **Step 2: Run the structure check to verify it fails**

Run: `node scripts/check-sdkwork-claw-structure.mjs`

Expected: FAIL because the new feature package tree does not exist yet.

- [ ] **Step 3: Create minimal feature bridges**

For each migrated package:

- create `package.json`, `tsconfig.json`, and `src/index.ts`
- re-export from the old `@sdkwork/claw-studio-*` package when a matching feature already exists
- for `sdkwork-claw-auth`, create a minimal placeholder export that intentionally fails route checks until the V5 auth feature is ported

- [ ] **Step 4: Re-run the structure check**

Run: `node scripts/check-sdkwork-claw-structure.mjs`

Expected: PASS for package existence and package-name assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-account packages/sdkwork-claw-apps packages/sdkwork-claw-auth packages/sdkwork-claw-center packages/sdkwork-claw-channels packages/sdkwork-claw-chat packages/sdkwork-claw-community packages/sdkwork-claw-devices packages/sdkwork-claw-docs packages/sdkwork-claw-extensions packages/sdkwork-claw-github packages/sdkwork-claw-huggingface packages/removed-install-feature packages/sdkwork-claw-instances packages/sdkwork-claw-market packages/sdkwork-claw-settings packages/sdkwork-claw-tasks scripts/check-sdkwork-claw-structure.mjs
git commit -m "feat: add sdkwork claw feature package skeleton"
```

---

## Chunk 2: Rebuild Shared Foundations And New Hosts

### Task 4: Build `sdkwork-claw-ui` From V5 Commons And Shared UI

**Files:**
- Modify: `packages/sdkwork-claw-ui/package.json`
- Modify: `packages/sdkwork-claw-ui/src/index.ts`
- Create: `packages/sdkwork-claw-ui/src/lib/utils.ts`
- Create: `packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- Create: `packages/sdkwork-claw-ui/src/components/index.ts`
- Create: `packages/sdkwork-claw-ui/src/components/Modal.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/RepositoryCard.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/ui/*`
- Modify: `packages/sdkwork-claw-account/src/**/*`
- Modify: `packages/sdkwork-claw-market/src/**/*`
- Modify: `packages/sdkwork-claw-settings/src/**/*`
- Modify: `packages/sdkwork-claw-github/src/**/*`
- Modify: `packages/sdkwork-claw-huggingface/src/**/*`
- Modify: `packages/sdkwork-claw-devices/src/**/*`
- Modify: `packages/sdkwork-claw-extensions/src/**/*`

- [ ] **Step 1: Write the failing UI tests**

Create:

```ts
// packages/sdkwork-claw-ui/src/lib/utils.test.ts
import assert from 'node:assert/strict';
import { cn } from './utils.ts';

assert.equal(cn('a', undefined, 'b'), 'a b');
```

Extend `scripts/check-sdkwork-claw-structure.mjs` so it fails if active `sdkwork-claw-*` packages still import `@sdkwork/claw-studio-shared-ui` or V5 `sdkwork-claw-commons`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- `node scripts/check-sdkwork-claw-structure.mjs`

Expected: FAIL because `sdkwork-claw-ui` is still only a bridge.

- [ ] **Step 3: Implement the new shared UI package**

Seed from:

- `upgrade/claw-studio-v5/packages/sdkwork-claw-commons`
- current `packages/claw-studio-shared-ui`

Then normalize consumers so shared components import from `@sdkwork/claw-ui`.

- [ ] **Step 4: Re-run the tests**

Run the same two commands again.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-ui packages/sdkwork-claw-account packages/sdkwork-claw-market packages/sdkwork-claw-settings packages/sdkwork-claw-github packages/sdkwork-claw-huggingface packages/sdkwork-claw-devices packages/sdkwork-claw-extensions scripts/check-sdkwork-claw-structure.mjs
git commit -m "feat: build sdkwork claw ui foundation"
```

### Task 5: Re-home Shared Logic Into `sdkwork-claw-core`, `sdkwork-claw-i18n`, `sdkwork-claw-types`, And `sdkwork-claw-distribution`

**Files:**
- Modify: `packages/sdkwork-claw-core/src/index.ts`
- Create: `packages/sdkwork-claw-core/src/store/useAppStore.ts`
- Create: `packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/contracts.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/registry.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/index.ts`
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Create: `packages/sdkwork-claw-i18n/src/index.test.ts`
- Create or replace: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Create or replace: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `packages/sdkwork-claw-distribution/src/index.ts`
- Modify: `scripts/check-sdkwork-claw-hosts.mjs`

- [ ] **Step 1: Write the failing shared-foundation tests**

Create:

```ts
// packages/sdkwork-claw-core/src/runtime/registry.test.ts
import assert from 'node:assert/strict';
import { createRuntimeRegistry } from './registry.ts';

const registry = createRuntimeRegistry();
assert.equal(typeof registry.register, 'function');
```

```ts
// packages/sdkwork-claw-i18n/src/index.test.ts
import assert from 'node:assert/strict';
import { ensureI18n } from './index.ts';

const i18n = await ensureI18n();
assert.equal(i18n.hasResourceBundle('en', 'translation'), true);
assert.equal(i18n.hasResourceBundle('zh', 'translation'), true);
```

Also extend host checks so they fail if runtime contracts still live only in `claw-studio-business` and `claw-studio-infrastructure`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `node scripts/check-sdkwork-claw-hosts.mjs`

Expected: FAIL because the new shared foundation packages are still bridges.

- [ ] **Step 3: Re-home the shared foundation**

Move:

- shared app store behavior from `claw-studio-business`
- runtime capability contracts and helpers from `claw-studio-business` and `claw-studio-infrastructure`
- i18n bootstrap and locale resources from `claw-studio-infrastructure`
- distribution manifest exports from `claw-studio-distribution`
- pure shared types from `claw-studio-domain`

Keep old packages as bridge exports until final cleanup.

- [ ] **Step 4: Re-run the tests**

Run the same four commands again.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-core packages/sdkwork-claw-i18n packages/sdkwork-claw-types packages/sdkwork-claw-distribution scripts/check-sdkwork-claw-hosts.mjs
git commit -m "feat: re-home shared sdkwork claw foundations"
```

### Task 6: Build The New Shared Shell And Dual Hosts

**Files:**
- Create: `packages/sdkwork-claw-shell/src/application/app/AppRoot.tsx`
- Create: `packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx`
- Create: `packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx`
- Create: `packages/sdkwork-claw-shell/src/application/providers/ThemeManager.tsx`
- Create: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Create: `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- Create: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Create: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Create: `packages/sdkwork-claw-shell/src/components/GlobalTaskManager.tsx`
- Create: `packages/sdkwork-claw-shell/src/styles/index.css`
- Create: `packages/sdkwork-claw-web/index.html`
- Create: `packages/sdkwork-claw-web/server.ts`
- Create: `packages/sdkwork-claw-web/src/main.tsx`
- Create: `packages/sdkwork-claw-web/src/App.tsx`
- Create: `packages/sdkwork-claw-desktop/index.html`
- Create: `packages/sdkwork-claw-desktop/vite.config.ts`
- Create: `packages/sdkwork-claw-desktop/src/vite-env.d.ts`
- Create: `packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/providers/DesktopProviders.tsx`
- Create: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Create or copy: `packages/sdkwork-claw-desktop/src-tauri/*`

- [ ] **Step 1: Write the failing host and route checks**

Add host assertions such as:

```js
assertFileIncludes('packages/sdkwork-claw-web/src/App.tsx', '@sdkwork/claw-shell');
assertFileIncludes('packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx', '@sdkwork/claw-shell');
assertFileIncludes('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx', '/chat');
```

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-hosts.mjs`
- `node scripts/check-sdkwork-claw-route-surface.mjs`

Expected: FAIL because the new hosts and shell are not assembled yet.

- [ ] **Step 3: Build the new host and shell packages**

Implementation rules:

- copy the stable shell composition patterns from `claw-studio-shell`
- point imports at `@sdkwork/claw-*`
- keep browser and desktop mounting the same shell package
- keep desktop-only providers in `@sdkwork/claw-desktop`

- [ ] **Step 4: Re-run the checks**

Run the same two commands again.

Expected: PASS for host wiring and baseline shell route assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-shell packages/sdkwork-claw-web packages/sdkwork-claw-desktop scripts/check-sdkwork-claw-hosts.mjs scripts/check-sdkwork-claw-route-surface.mjs
git commit -m "feat: add sdkwork claw shell and dual hosts"
```

---

## Chunk 3: Port The V5 Feature Packages And Product Surface

### Task 7: Port Workspace And Ecosystem Feature Packages

**Files:**
- Create or replace: `packages/sdkwork-claw-auth/**/*`
- Create or replace: `packages/sdkwork-claw-account/**/*`
- Create or replace: `packages/sdkwork-claw-chat/**/*`
- Create or replace: `packages/sdkwork-claw-channels/**/*`
- Create or replace: `packages/sdkwork-claw-tasks/**/*`
- Create or replace: `packages/sdkwork-claw-apps/**/*`
- Create or replace: `packages/sdkwork-claw-extensions/**/*`
- Create or replace: `packages/sdkwork-claw-community/**/*`
- Create or replace: `packages/sdkwork-claw-github/**/*`
- Create or replace: `packages/sdkwork-claw-huggingface/**/*`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `scripts/v5-product-contract.test.ts`

- [ ] **Step 1: Extend the failing V5 contract tests for the first feature group**

Add assertions for:

- `/auth`
- `/account`
- `/chat`
- `/channels`
- `/tasks`
- `/apps`
- `/extensions`
- `/community`
- `/github`
- `/huggingface`

Also assert package-root imports from `@sdkwork/claw-*`.

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-route-surface.mjs`
- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: FAIL because the new packages still use bridge exports or missing features.

- [ ] **Step 3: Port the first feature group from V5**

Port from `upgrade/claw-studio-v5/packages/*`, then normalize:

- shared UI imports -> `@sdkwork/claw-ui`
- shared app/runtime imports -> `@sdkwork/claw-core`
- types -> `@sdkwork/claw-types`

Do not leave feature-to-feature deep imports.

- [ ] **Step 4: Re-run the checks**

Run the same two commands again.

Expected: PASS for the first feature-group surface.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-auth packages/sdkwork-claw-account packages/sdkwork-claw-chat packages/sdkwork-claw-channels packages/sdkwork-claw-tasks packages/sdkwork-claw-apps packages/sdkwork-claw-extensions packages/sdkwork-claw-community packages/sdkwork-claw-github packages/sdkwork-claw-huggingface packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx packages/sdkwork-claw-shell/src/components/Sidebar.tsx scripts/v5-product-contract.test.ts scripts/check-sdkwork-claw-route-surface.mjs
git commit -m "feat: port sdkwork claw workspace and ecosystem features"
```

### Task 8: Port Setup And Support Feature Packages

**Files:**
- Create or replace: `packages/sdkwork-claw-center/**/*`
- Create or replace: `packages/sdkwork-claw-devices/**/*`
- Create or replace: `packages/sdkwork-claw-docs/**/*`
- Create or replace: `packages/removed-install-feature/**/*`
- Create or replace: `packages/sdkwork-claw-instances/**/*`
- Create or replace: `packages/sdkwork-claw-market/**/*`
- Create or replace: `packages/sdkwork-claw-settings/**/*`
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `scripts/v5-product-contract.test.ts`

- [ ] **Step 1: Extend the failing V5 contract tests for the second feature group**

Add assertions for:

- `/install`
- `/instances`
- `/devices`
- `/claw-center`
- `/claw-upload`
- `/market`
- `/settings`
- `/docs`

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-route-surface.mjs`
- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: FAIL because this second feature group and shell gaps are not fully ported yet.

- [ ] **Step 3: Port the second feature group from V5**

Port the remaining feature packages and preserve the V5 visuals and flows as closely as possible.

- [ ] **Step 4: Re-run the checks**

Run the same two commands again.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-center packages/sdkwork-claw-devices packages/sdkwork-claw-docs packages/removed-install-feature packages/sdkwork-claw-instances packages/sdkwork-claw-market packages/sdkwork-claw-settings packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx packages/sdkwork-claw-shell/src/components/Sidebar.tsx scripts/v5-product-contract.test.ts scripts/check-sdkwork-claw-route-surface.mjs
git commit -m "feat: port sdkwork claw setup and support features"
```

### Task 9: Finish V5 Shell, Route, And Visual Parity

**Files:**
- Modify: `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- Modify: `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/CommandPalette.tsx`
- Modify: `packages/sdkwork-claw-shell/src/components/GlobalTaskManager.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/providers/ThemeManager.tsx`
- Modify: `packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx`
- Modify: `scripts/v5-product-contract.test.ts`
- Create: `docs/plans/2026-03-15-sdkwork-claw-manual-qa.md`

- [ ] **Step 1: Write the failing shell parity checks**

Add assertions for:

- V5 sidebar navigation groups and order
- V5 auth-route shell behavior
- V5 command palette command surface
- V5 theme and language application
- V5 global task manager affordances

Document manual screenshot checks for:

- auth
- chat
- market
- settings
- docs
- community

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: FAIL because shell-level product parity is not complete yet.

- [ ] **Step 3: Implement the final shell parity fixes**

Keep the V5 visual and behavioral contract. Do not redesign the product.

- [ ] **Step 4: Re-run the checks**

Run:

- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-shell scripts/v5-product-contract.test.ts docs/plans/2026-03-15-sdkwork-claw-manual-qa.md
git commit -m "feat: finish sdkwork claw shell parity"
```

---

## Chunk 4: Switch The Active Hosts, Remove Old Packages, And Finalize The Template

### Task 10: Switch Root Scripts, Docs, And Checks To The New Package Graph

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-arch-boundaries.mjs`
- Modify: `scripts/check-desktop-platform-foundation.mjs`
- Modify: `scripts/sync-feature-packages.mjs`
- Modify: `docs/core/packages.md`
- Modify: `docs/zh-CN/core/packages.md`
- Modify: `docs/index.md`
- Modify: `docs/zh-CN/index.md`
- Modify: `docs/features/overview.md`
- Modify: `docs/zh-CN/features/overview.md`

- [ ] **Step 1: Extend the checks so they fail on old active package names**

Add assertions such as:

- root `dev/build/preview` target `@sdkwork/claw-web`
- desktop scripts target `@sdkwork/claw-desktop`
- architecture checks treat `sdkwork-claw-*` as the active package family
- docs stop describing `claw-studio-*` as the primary architecture

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-structure.mjs`
- `node scripts/check-sdkwork-claw-hosts.mjs`
- `node scripts/check-arch-boundaries.mjs`

Expected: FAIL because root scripts and docs still point at the old family.

- [ ] **Step 3: Switch the active tooling and docs**

Update:

- root scripts
- architecture checks
- sync scripts
- public docs

so the `sdkwork-claw-*` graph becomes the documented and enforced default.

- [ ] **Step 4: Re-run the checks**

Run the same three commands again.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-arch-boundaries.mjs scripts/check-desktop-platform-foundation.mjs scripts/sync-feature-packages.mjs docs/core/packages.md docs/zh-CN/core/packages.md docs/index.md docs/zh-CN/index.md docs/features/overview.md docs/zh-CN/features/overview.md
git commit -m "feat: switch workspace tooling to sdkwork claw packages"
```

### Task 11: Remove Obsolete `claw-studio-*` Packages From The Active Graph

**Files:**
- Remove after verification: `packages/claw-studio-account`
- Remove after verification: `packages/claw-studio-apps`
- Remove after verification: `packages/claw-studio-business`
- Remove after verification: `packages/claw-studio-channels`
- Remove after verification: `packages/claw-studio-chat`
- Remove after verification: `packages/claw-studio-claw-center`
- Remove after verification: `packages/claw-studio-community`
- Remove after verification: `packages/claw-studio-desktop`
- Remove after verification: `packages/claw-studio-devices`
- Remove after verification: `packages/claw-studio-distribution`
- Remove after verification: `packages/claw-studio-docs`
- Remove after verification: `packages/claw-studio-domain`
- Remove after verification: `packages/claw-studio-extensions`
- Remove after verification: `packages/claw-studio-github`
- Remove after verification: `packages/claw-studio-huggingface`
- Remove after verification: `packages/claw-studio-infrastructure`
- Remove after verification: `packages/removed-install-feature`
- Remove after verification: `packages/claw-studio-instances`
- Remove after verification: `packages/claw-studio-market`
- Remove after verification: `packages/claw-studio-settings`
- Remove after verification: `packages/claw-studio-shared-ui`
- Remove after verification: `packages/claw-studio-shell`
- Remove after verification: `packages/claw-studio-tasks`
- Remove after verification: `packages/claw-studio-web`
- Modify: `scripts/check-sdkwork-claw-structure.mjs`
- Modify: `scripts/check-sdkwork-claw-hosts.mjs`

- [ ] **Step 1: Extend the cleanup checks**

Make the structure and host checks fail if:

- any old `claw-studio-*` package remains on the active import graph
- any root script still references `@sdkwork/claw-studio-*`
- any new host imports old package internals directly

- [ ] **Step 2: Run the checks to verify they fail**

Run:

- `node scripts/check-sdkwork-claw-structure.mjs`
- `node scripts/check-sdkwork-claw-hosts.mjs`

Expected: FAIL because the old graph still exists.

- [ ] **Step 3: Delete obsolete packages and dead references**

Only remove a package after confirming:

- the matching `sdkwork-claw-*` package is active
- all imports have switched
- `pnpm lint` and `pnpm build` still pass before and after deletion

- [ ] **Step 4: Re-run the checks**

Run the same two commands again.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/check-sdkwork-claw-structure.mjs scripts/check-sdkwork-claw-hosts.mjs
git rm -r packages/claw-studio-account packages/claw-studio-apps packages/claw-studio-business packages/claw-studio-channels packages/claw-studio-chat packages/claw-studio-claw-center packages/claw-studio-community packages/claw-studio-desktop packages/claw-studio-devices packages/claw-studio-distribution packages/claw-studio-docs packages/claw-studio-domain packages/claw-studio-extensions packages/claw-studio-github packages/claw-studio-huggingface packages/claw-studio-infrastructure packages/removed-install-feature packages/claw-studio-instances packages/claw-studio-market packages/claw-studio-settings packages/claw-studio-shared-ui packages/claw-studio-shell packages/claw-studio-tasks packages/claw-studio-web
git commit -m "feat: remove obsolete claw studio package graph"
```

### Task 12: Full Verification And Template Closeout

**Files:**
- Modify as needed: `docs/plans/2026-03-15-sdkwork-claw-manual-qa.md`
- Modify as needed: `scripts/check-sdkwork-claw-structure.mjs`
- Modify as needed: `scripts/check-sdkwork-claw-route-surface.mjs`
- Modify as needed: `scripts/check-sdkwork-claw-hosts.mjs`
- Modify as needed: `scripts/v5-product-contract.test.ts`

- [ ] **Step 1: Run package and architecture verification**

Run:

- `node scripts/check-sdkwork-claw-structure.mjs`
- `node scripts/check-sdkwork-claw-route-surface.mjs`
- `node scripts/check-sdkwork-claw-hosts.mjs`
- `node scripts/check-arch-boundaries.mjs`

Expected: PASS

- [ ] **Step 2: Run product contract verification**

Run:

- `node --experimental-strip-types scripts/v5-product-contract.test.ts`

Expected: PASS

- [ ] **Step 3: Run workspace verification**

Run:

- `pnpm lint`
- `pnpm build`

Expected: PASS

- [ ] **Step 4: Run desktop-host verification**

Run:

- `pnpm --filter @sdkwork/claw-desktop lint`
- `pnpm --filter @sdkwork/claw-desktop build`
- `pnpm --filter @sdkwork/claw-desktop tauri:build`

Expected: PASS in a complete desktop build environment

- [ ] **Step 5: Complete the manual QA checklist**

Verify visually against `upgrade/claw-studio-v5` for:

- auth
- chat
- market
- settings
- docs
- instances
- community
- desktop runtime affordances

Expected: approved screenshot-level parity with no major route, visual, or capability regressions

- [ ] **Step 6: Commit**

```bash
git add docs/plans/2026-03-15-sdkwork-claw-manual-qa.md scripts/check-sdkwork-claw-structure.mjs scripts/check-sdkwork-claw-route-surface.mjs scripts/check-sdkwork-claw-hosts.mjs scripts/v5-product-contract.test.ts
git commit -m "chore: complete sdkwork claw v5 migration verification"
```
