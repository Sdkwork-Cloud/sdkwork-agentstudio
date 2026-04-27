# CrawStudio Packaged Install Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt the new Windows packaged install standard so the desktop runtime distinguishes install-root assets, machine-level state, and user-private assets while supporting built-in managed modules, bounded version retention, and future service-driven updates.

**Architecture:** Replace the generic Tauri app-data layout with an explicit three-domain path model. `Program Files` holds runnable assets and built-in modules, `ProgramData` holds machine state and finite package inventory, and `~/.sdkwork/crawstudio/` holds user-private assets. Existing storage and integration services are remapped to the correct domain rather than left under generic app data roots.

**Tech Stack:** Rust, Tauri v2, TypeScript bridge contracts, serde, serde_json, pnpm workspace scripts

---

### Task 1: Freeze the final directory standard in docs

**Files:**
- Create: `docs/plans/2026-03-19-crawstudio-packaged-install-layout-design.md`
- Create: `docs/plans/2026-03-19-crawstudio-packaged-install-layout-implementation-plan.md`

**Step 1: Re-read the current desktop layout implementation**

Run: `Get-Content -Path 'packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs' -TotalCount 260`
Expected: current path model still uses generic config, data, cache, logs, state, storage, plugins, integrations, and backups folders.

**Step 2: Confirm the design addresses version-growth, rollback, and user-path requirements**

Expected: design explicitly uses `Program Files`, `ProgramData`, and `~/.sdkwork/crawstudio/`, and defines finite retention.

**Step 3: Keep both docs aligned before code work starts**

Expected: the docs become the authoritative contract for subsequent code changes.

### Task 2: Add failing Rust tests for the new three-domain path model

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`

**Step 1: Write failing tests for the new path roots**

Add tests that assert:

- install-root assets live under `Program Files` in runtime mode and under `install/` in test-root mode
- machine state lives under `ProgramData` in runtime mode and under `machine/` in test-root mode
- user-private assets live under `~/.sdkwork/crawstudio/` in runtime mode and under `app-user-root/` in test-root mode
- required subdirectories are created for modules, runtimes, store, staging, user storage, and user integrations

**Step 2: Run the focused tests to verify failure**

Run: `cargo test paths --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because the current path model still reflects the older generic data layout.

**Step 3: Implement the minimal new `AppPaths` structure**

Expected: `AppPaths` becomes a three-domain path model with explicit install, machine, and user roots plus typed subdirectories.

**Step 4: Re-run the focused tests**

Run: `cargo test paths --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 3: Remap kernel snapshots to the new layout

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs`

**Step 1: Write failing assertions for the new kernel directory snapshot**

Add or update tests so the kernel snapshot reports:

- install-root module and runtime directories
- machine `state`, `store`, and `staging` directories
- user `storage`, `integrations`, and `studio backups` directories

**Step 2: Run the focused kernel test target**

Run: `cargo test desktop_kernel --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because kernel snapshots still expose the legacy directory names and paths.

**Step 3: Implement the minimal kernel projection changes**

Expected: the kernel surface describes the new path model clearly without leaking deprecated semantics.

**Step 4: Re-run the focused kernel test target**

Run: `cargo test desktop_kernel --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 4: Remap storage to the user-private domain

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage/profiles.rs`

**Step 1: Write failing tests for the new default storage root**

Add tests that assert:

- default local-file storage roots under `~/.sdkwork/crawstudio/user/storage`
- relative storage profile paths resolve under the new user storage root

**Step 2: Run the storage test target to verify failure**

Run: `cargo test storage --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because local storage still resolves under the legacy storage root.

**Step 3: Implement the minimal path remapping**

Expected: storage stays functional while now living in the user-private domain.

**Step 4: Re-run the storage test target**

Run: `cargo test storage --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 5: Remap integrations and plugin semantics to the right domains

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/integrations.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/commands/install_api_router_client_setup.rs`

**Step 1: Write failing tests for user-scoped integrations**

Add tests that assert:

- integration config writes land under `~/.sdkwork/crawstudio/user/integrations`
- plugin payload directories are reported from the install-root extension area instead of generic app data

**Step 2: Run the focused tests to verify failure**

Run: `cargo test install_api_router_client_setup --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because integration writes still target the old integrations root.

**Step 3: Implement the minimal remapping**

Expected: plugin payloads become install-root assets while mutable integration configuration becomes user-scoped.

**Step 4: Re-run the focused tests**

Run: `cargo test install_api_router_client_setup --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 6: Add the machine-state metadata contracts

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs`

**Step 1: Write failing tests for the new machine-state files**

Add tests that assert the runtime initializes:

- `app.json`
- `layout.json`
- `active.json`
- `inventory.json`
- `retention.json`
- `pinned.json`
- `channels.json`
- `policies.json`
- `sources.json`
- `service.json`

with safe defaults.

**Step 2: Run the focused tests**

Run: `cargo test layout --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because those machine-state contracts do not exist yet.

**Step 3: Implement the minimal metadata layer**

Expected: machine-state JSON files become first-class contracts rather than ad hoc future intentions, including the full standard `state\` surface defined by the packaged install design.

**Step 4: Re-run the focused tests**

Run: `cargo test layout --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 7: Add the first retention-policy enforcement slice

**Files:**
- Create: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/retention.rs`
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`

**Step 1: Write failing tests for finite package retention**

Add tests that assert:

- module package inventory is trimmed to the configured limit
- pinned versions are preserved
- packages referenced by active or fallback slots are preserved

**Step 2: Run the focused test target**

Run: `cargo test retention --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: FAIL because no retention service exists yet.

**Step 3: Implement the minimal retention pruning logic**

Expected: the repo gains an enforceable finite-store policy rather than only a documented rule.

**Step 4: Re-run the focused test target**

Run: `cargo test retention --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

### Task 8: Update bridge and desktop-facing path contracts

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src/desktop/catalog.ts`
- Modify: `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts` if needed for future module-management surface

**Step 1: Add failing assertions for any changed desktop kernel path names**

Expected: TypeScript-facing contracts reflect the new domain names without silently drifting from Rust.

**Step 2: Run the desktop contract checks**

Run: `pnpm check:desktop-kernel`
Expected: FAIL until the path surface and snapshots are aligned.

**Step 3: Implement the minimal bridge updates**

Expected: renderer-side code sees the new layout terminology consistently.

**Step 4: Re-run the contract checks**

Run: `pnpm check:desktop-kernel`
Expected: PASS

### Task 9: Run focused verification and inspect the final diff

**Files:**
- Modify: none

**Step 1: Run the focused Rust test groups**

Run: `cargo test paths --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

Run: `cargo test desktop_kernel --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

Run: `cargo test storage --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

Run: `cargo test install_api_router_client_setup --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
Expected: PASS

**Step 2: Run the repo-level desktop verification**

Run: `pnpm check:desktop`
Expected: PASS

**Step 3: Review the diff**

Run: `git diff -- docs/plans packages/sdkwork-claw-desktop packages/sdkwork-claw-infrastructure`
Expected: only the intended packaging-layout files and path-model updates are included.
