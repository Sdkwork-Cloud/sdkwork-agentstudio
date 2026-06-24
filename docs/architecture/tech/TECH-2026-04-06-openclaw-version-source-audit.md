> Migrated from `docs/review/2026-04-06-openclaw-version-source-audit.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Version Source Audit

## Scope

This audit closes the open question raised during the desktop/OpenClaw stabilization work:

- why `pnpm.cmd check:desktop` still reports `2026.4.2`
- whether the repository is still pinned to an obsolete OpenClaw build
- whether the earlier `2026.3.13` references are still part of the active bundled runtime path

## Upstream Conclusion

As of `2026-04-06`, the official upstream GitHub releases page still shows `v2026.4.2` as the latest stable OpenClaw release:

- https://github.com/openclaw/openclaw/releases

That means the current bundled stable version in this repository is not stale purely because it is `2026.4.2`.

## Active Source-Of-Truth Chain

The active bundled OpenClaw version is sourced from one canonical metadata file and then projected through the desktop build/runtime stack:

1. `config/openclaw-release.json`
   - `stableVersion = "2026.4.2"`
2. `packages/sdkwork-claw-types/src/openclawRelease.ts`
   - exports `DEFAULT_BUNDLED_OPENCLAW_VERSION` from the shared release metadata
3. `scripts/sync-bundled-components.mjs`
   - normalizes bundled component metadata to the shared stable version
4. `packages/sdkwork-claw-desktop/src-tauri/foundation/components/component-registry.json`
   - bundled component registry declares `bundledVersion = "2026.4.2"`
5. `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
   - packaged embedded runtime manifest declares `openclawVersion = "2026.4.2"`
6. `packages/sdkwork-claw-desktop/src-tauri/src/framework/openclaw_release.rs`
   - Rust host consumes the bundled version via `SDKWORK_BUNDLED_OPENCLAW_VERSION`

Result: the desktop package, TypeScript runtime metadata, and Rust embedded host are aligned on the same stable version chain.

## Findings

### 1. `2026.4.2` is the intentional shared stable version, not an accidental stale pin

`pnpm.cmd check:desktop` logs `2026.4.2` because the bundled-component sync process normalizes the desktop bundle to the shared release metadata. That behavior currently matches the upstream stable release.

### 2. `2026.3.13` is not part of the active bundled release chain anymore

Current repository evidence shows that `2026.3.13` survives only in historical reports, retired fixture guards, or deleted local artifacts. It is not the value used by:

- the shared release metadata
- the bundled component registry
- the packaged runtime manifest
- the Rust host embedded runtime version export

### 3. Some test fixtures and historical documents can still confuse the audit trail

The repository still contains historical references to:

- `2026.3.13` in reports and retirement guards
- `2026.4.1` and `2026.4.2-beta.1` in fixture-style tests

These are not product runtime pins, but they make version review noisy and easy to misread without a dedicated audit note.

### 4. Some `2026.4.2` literals are fixture data, not runtime configuration drift

For example, `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs` contains `2026.4.2` in tests that validate runtime-directory migration behavior. Those literals are exercising migration semantics, not defining the shipping version source of truth.

## Decision

No production version bump should be made in this iteration.

The correct action is:

- keep the active stable bundled version on `2026.4.2`
- continue to derive all desktop/runtime packaging metadata from the shared release metadata
- only bump when upstream latest stable actually changes

Blindly changing the version number higher would break the current release contract and would stop the package from matching upstream truth.

## Improvement Actions

### Immediate

1. Keep `config/openclaw-release.json` as the only stable-version entry point.
2. Treat `pnpm.cmd check:desktop` outputting `2026.4.2` as correct until upstream latest stable changes.
3. Use this audit as the reference note when future review passes flag `2026.4.2` as "old".

### Follow-up hardening

1. Add a short operator/developer note to the release docs explaining that bundled OpenClaw version changes must start from `config/openclaw-release.json`.
2. Consider adding one stricter contract that fails if:
   - `component-registry.json`
   - `resources/openclaw/manifest.json`
   - generated release manifests
   drift away from the shared release metadata.
3. Keep historical or fixture-only version literals clearly scoped to tests so they are not mistaken for active product pins.

## Impact On Current Review Queue

This audit closes the "upgrade to the latest version" ambiguity for the current iteration.

The next real gaps remain elsewhere:

1. built-in OpenClaw packaged first-launch readiness
2. file/workbench visibility correctness
3. chat/notification/cron/proxy/token observability end-to-end validation

