> Migrated from `docs/release/release-2026-04-07-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Carried forward every unpublished April 7 change from `release-2026-04-07-01` through `release-2026-04-07-08` into one new release candidate.
- Repaired the desktop embedded-host public studio wiring so the shared workbench API and managed OpenClaw control plane are rebuilt from the live desktop `manage_openclaw_provider`, not cloned from the inactive pre-desktop server state.
- Fixed the desktop public instance-detail path so `workbench: null` coming from shared detail no longer triggers a 500 during record deserialization.
- Updated the desktop OpenClaw mirror-import fixture to satisfy the current runtime readiness contract, including `doctor --fix --non-interactive --yes`, `gateway health --json`, and the allowlisted `cron.status` invoke probe.
- Realigned stale desktop Rust test expectations with current runtime semantics for offline built-in base URLs and offline external-profile console access.
- Preserved the local relative-path shared SDK workflow while continuing to verify release mode with `SDKWORK_SHARED_SDK_MODE=git`.

## Attempt Outcome

- This is the next release candidate after the unpublished `release-2026-04-07-08` attempt.
- `release-2026-04-07-08` failed in GitHub Actions run `24076080749`, so that tag must remain failed and unpublished.
- Fresh local release-mode verification now passes across lint, desktop checks, server checks, the full desktop Rust suite, web build, server build, and docs build with `CI=1` and `SDKWORK_SHARED_SDK_MODE=git`.
- If GitHub publication succeeds, this tag should become the first successful April 7 GitHub Release and replace every earlier unpublished candidate.

## Verification Focus

- Confirm the repaired desktop embedded-host authority path stays green in the focused Rust regressions:
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_canonical_public_studio_routes -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_canonical_public_studio_workbench_mutation_routes -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_detail_route_reflects_shared_workbench_mutations -- --nocapture`
- Confirm the repaired desktop runtime fixtures and expectations stay green:
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_can_restart_gateway_when_requested -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_can_leave_gateway_stopped_after_restore -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml built_in_instance_reads_http_auth_from_managed_openclaw_config -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_reads_profile_specific_install_record_shape -- --nocapture`
- Confirm the full release-mode batch remains green:
  - `pnpm lint`
  - `pnpm check:desktop`
  - `pnpm check:server`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
  - `pnpm build`
  - `pnpm server:build`
  - `pnpm docs:build`
- Confirm `node scripts/release/render-release-notes.mjs --release-tag release-2026-04-07-09` renders one merged release body that carries forward `release-2026-04-07-01` through `release-2026-04-07-08`.
- Confirm GitHub Actions completes the release workflow for `release-2026-04-07-09` and that a GitHub Release object exists for that tag.

