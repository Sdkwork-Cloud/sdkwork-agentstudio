# 102-2026-04-08 OpenClaw Upgrade Rollback Evidence Chain

## Decision

Any Step 03 claim that the desktop OpenClaw runtime is upgrade-ready or rollback-ready must now be backed by one explicit evidence report that joins:

- `config/openclaw-release.json` as the baseline version source
- the prepared runtime inspection under `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw`
- the packaged release asset verification under `packages/sdkwork-claw-desktop/src-tauri/generated/release/openclaw-resource`

`check:desktop-openclaw-runtime` must execute `scripts/openclaw-upgrade-rollback-evidence.test.mjs` so the evidence surface stays under the same Step 03 gate as readiness, prepare, and packaged-release verification.

## Why

- Step 03 already had readiness, prepare, and packaged-release verification pieces, but rollback remained implicit and easy to overstate.
- The desktop managed OpenClaw chain still depends on one shared baseline across the host truth source, writable instance config, provider projection, channel management, agent installation, and loopback proxy projection.
- `plugins/mod.rs` deliberately remains host-plugin registration only, so rollback provenance cannot live in plugin bootstrap side effects.

## Standard

- A rollback baseline version must align across the release config, bundled runtime manifest, and packaged release manifest.
- The prepared runtime for that baseline must remain reusable.
- The packaged release assets for that baseline must verify for the requested desktop target.
- If any of those checks fail, `CP03-3` remains open regardless of how many individual scripts or docs pass in isolation.

## Impact

- Desktop OpenClaw rollback evidence is now auditable through one JSON report instead of manual correlation.
- The Step 03 desktop runtime gate can distinguish "pieces exist" from "rollback baseline is actually proven."
- Remaining Step 03 release work can now focus on the real gaps: broader multi-mode startup smoke, true upgrade execution evidence, and unresolved runtime hotspots.
