# OpenClaw Runtime Regression Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining Rust runtime regression failures so the desktop kernel/runtime integration is commercially shippable at the library-test level.

**Architecture:** Keep the current OpenClaw managed-runtime authority model intact and fix only the two proven regression paths: mirror import should reject malformed archives before doctor execution, and runtime reinstall should deterministically restore bundled payloads after integrity mismatch. The repair is bounded to Rust desktop services plus targeted tests, with no retired chat product scope.

**Tech Stack:** Rust, Tauri desktop host, Cargo tests, existing OpenClaw runtime/mirror services

---

### Task 1: Mirror Import Mismatch Guard

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs`

- [ ] **Step 1: Run the failing test and capture the exact stack**

Run: `node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rejects_component_file_count_mismatch -- --nocapture`
Expected: FAIL with the current unexpected `io error: program not found` path.

- [ ] **Step 2: Trace the malformed archive validation flow**

Read the test and the import pipeline to verify where component file-count mismatch should be rejected versus where post-import doctor is currently invoked.

- [ ] **Step 3: Write or tighten the failing assertion first if coverage is incomplete**

Ensure the test proves the malformed archive is rejected before any post-import doctor/runtime execution path is reached.

- [ ] **Step 4: Implement the minimal root-cause fix**

Prevent malformed mirror imports from progressing into doctor execution when archive/component validation already proves the restored runtime is incomplete or invalid.

- [ ] **Step 5: Re-run the targeted test**

Run: `node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_rejects_component_file_count_mismatch -- --nocapture`
Expected: PASS

### Task 2: Runtime Reinstall Payload Restoration

**Files:**
- Modify: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
- Test: `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

- [ ] **Step 1: Run the failing test and capture the exact assertion delta**

Run: `node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml reinstalls_existing_install_when_runtime_sidecar_integrity_mismatch_is_detected -- --nocapture`
Expected: FAIL because the restored `openclaw/package.json` does not contain the bundled test version.

- [ ] **Step 2: Compare the reinstall path against the working bundled-install flow**

Trace how integrity mismatch is detected, how reinstall is triggered, and where the existing payload is expected to be replaced or preserved incorrectly.

- [ ] **Step 3: Confirm the failing test is the red test for the root cause**

If needed, sharpen the assertion so it proves the reinstall path replaces the corrupted install with the bundled runtime payload.

- [ ] **Step 4: Implement the minimal root-cause fix**

Make reinstall semantics deterministic so integrity mismatch always refreshes the managed runtime payload that later kernel activation depends on.

- [ ] **Step 5: Re-run the targeted test**

Run: `node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml reinstalls_existing_install_when_runtime_sidecar_integrity_mismatch_is_detected -- --nocapture`
Expected: PASS

### Task 3: Full Regression Verification

**Files:**
- Verify: `packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Re-run both repaired targeted tests**

Run both task-specific Cargo commands again to confirm clean green output.

- [ ] **Step 2: Run the full Rust library suite**

Run: `node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --lib`
Expected: PASS with no remaining library-test regressions.

- [ ] **Step 3: Record the remaining commercial-readiness risks only if verified by evidence**

If any tests still fail or expose contract gaps, document only proven issues and their impact on kernel/runtime commercial readiness.
