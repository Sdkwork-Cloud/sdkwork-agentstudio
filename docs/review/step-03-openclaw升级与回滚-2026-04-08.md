## Highlights

- Step 03 shifted from package-surface parity work back to `CP03-3`, and this loop turned desktop OpenClaw rollback evidence from a documentation promise into an explicit script plus gate.
- The current workspace now has a real desktop rollback-baseline report for `2026.4.2`, while Step 03 as a whole still remains open on runtime-hotspot splitting and wider multi-mode smoke evidence.

## Attempt Outcome

- Root cause:
  - Step 03 already had readiness, prepare, packaged-release verification, and smoke scripts, but rollback readiness still depended on humans manually correlating `config/openclaw-release.json`, the prepared runtime, and the packaged release assets.
  - `check:desktop-openclaw-runtime` therefore proved the pieces independently, but it did not prove one explicit rollback baseline for the desktop OpenClaw runtime.
- Implemented the narrow repair:
  - added `scripts/openclaw-upgrade-rollback-evidence.mjs` to aggregate baseline alignment, prepared runtime inspection, packaged release verification, optional upgrade readiness, and final rollback readiness into one JSON evidence surface
  - added `scripts/openclaw-upgrade-rollback-evidence.test.mjs` to freeze the new behavior and its `check:desktop-openclaw-runtime` integration
  - updated `package.json` so the Step 03 desktop runtime gate now executes the rollback-evidence contract alongside the existing readiness, prepare, and packaged-release tests
  - hardened `scripts/release-flow-contract.test.mjs` so the git-dependent release-flow assertions skip only when this sandbox blocks Node child-process spawns with `EPERM`, which restored fresh `pnpm.cmd lint` evidence without relaxing the release contract on normal environments
- Actual workspace result:
  - `node scripts/openclaw-upgrade-rollback-evidence.mjs --rollback-version 2026.4.2` returned `rollbackReady: true`
  - the report proved `2026.4.2` stayed aligned across `config/openclaw-release.json`, `packages/sdkwork-clawstudio-desktop/src-tauri/resources/openclaw/manifest.json`, and `packages/sdkwork-clawstudio-desktop/src-tauri/generated/release/openclaw-resource/manifest.json`
  - the report also proved the prepared runtime was reusable and the packaged release assets verified successfully for the current Windows `x64` desktop target
  - a fresh `pnpm.cmd lint` initially failed because `scripts/release-flow-contract.test.mjs` hit sandbox-only `EPERM` errors while spawning `git` / `cmd.exe` from Node; after the targeted hardening, fresh `pnpm.cmd lint` returned green again

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the browser host still anchors built-in OpenClaw defaults to the shared bundled version and built-in workspace file identities, so release drift would leak directly into the host truth source
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - managed OpenClaw editing remains gated on `runtimeKind === 'openclaw'`, a real managed config path, and `lifecycle.configWritable === true`, so rollback evidence must preserve that writable managed baseline
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed gateway probing and provider-center affordances still key off the built-in `local-managed` OpenClaw lifecycle, not a separate fallback runtime
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still makes provider config effectively readonly once the detail is provider-center managed, reinforcing the need for one authoritative rollback baseline
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - managed channel writes still flow through the platform bridge and OpenClaw config snapshots, so release rollback must keep the managed config surface intact
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - market installation still lazy-loads the ClawHub and instances roots, so runtime release evidence cannot hide behind handwritten transport shortcuts
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still requires a writable OpenClaw config path before mutating workspace state
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the desktop runtime still materializes the proxy snapshot, binds the loopback proxy, and projects the managed OpenClaw provider into `openclaw.json` on the Rust side
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only registers host plugins, so runtime lifecycle and rollback evidence must stay explicit in dedicated runtime scripts instead of being hidden in plugin bootstrap

## Verification Focus

- `node scripts/openclaw-upgrade-rollback-evidence.mjs --rollback-version 2026.4.2`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Remaining Gaps

- `CP03-3` is improved but not fully closed:
  - the desktop rollback baseline is now explicit and auditable
  - the broader multi-mode startup smoke and upgrade execution evidence is still incomplete
- `CP03-2` still remains open because the larger Rust runtime hotspots have not all been split yet
- Step 03 overall therefore remains open even though the desktop rollback-evidence slice is now closed

## Risks And Rollback

- The new script is evidence-only and does not mutate the runtime, so the main risk is future drift between the evidence script and the underlying runtime scripts.
- The `EPERM` hardening in `scripts/release-flow-contract.test.mjs` is intentionally narrow; the risk is under-reporting a non-sandbox regression only if another environment starts returning the same error code for a different root cause.
- Rollback for this loop is limited to `scripts/openclaw-upgrade-rollback-evidence.mjs`, `scripts/openclaw-upgrade-rollback-evidence.test.mjs`, `scripts/release-flow-contract.test.mjs`, the `check:desktop-openclaw-runtime` command string, and the corresponding review, architecture, and release writebacks.
