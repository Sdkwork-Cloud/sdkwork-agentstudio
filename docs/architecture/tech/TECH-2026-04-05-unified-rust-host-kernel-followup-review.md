> Migrated from `docs/reports/2026-04-05-unified-rust-host-kernel-followup-review.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Rust Host Kernel Follow-up Review

Date: 2026-04-05

Scope:
- desktop embedded host
- standalone server host
- docker deployments built on the server host
- kubernetes deployments built on the server host
- shared chat, instance, config, cron, and readiness flows

## Executive Summary

The codebase now does more than share one Rust host kernel. After the Phase 2 hardening work and the additional managed-config follow-up in `instanceServiceCore`, the main runtime-truth regressions from the earlier review are no longer active blockers:

- desktop combined mode no longer exposes an inactive server control plane as the authoritative hosted OpenClaw source
- hosted desktop bootstrap no longer treats route presence alone as runtime readiness
- hosted manage gateway invoke is no longer a stubbed desktop-only dead end
- server, docker, and kubernetes no longer project fake writable built-in runtime ownership when no live managed runtime is attached
- hosted/browser managed OpenClaw config mutations no longer depend only on platform file I/O when a live gateway is available
- readiness and public workbench mutation contracts are now tied to live runtime authority instead of static route existence

The shared runtime architecture is materially more truthful now. The remaining gaps are narrower and mostly fall into two buckets:

1. one remaining desktop host mode contract mismatch
2. missing real packaged/manual runtime evidence outside this sandbox

## Verification Refresh

Commands executed on 2026-04-05 during the follow-up hardening pass:

- `cargo test --manifest-path packages/sdkwork-claw-host-studio/src-host/Cargo.toml built_in`
- `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml health`
- `cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml public_studio_workbench`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `node scripts/release-deployment-contract.test.mjs`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-host-runtime`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd build`
- `pnpm.cmd lint`
- `pnpm.cmd check:release-flow`

Result:

- all commands above passed
- the current automated suite now locks the corrected runtime-authority behavior much more directly than the earlier review state
- live packaged/manual runtime execution is still required outside this sandbox before release sign-off

## Resolved Findings

### 1. Resolved: desktop combined mode no longer has a hosted/direct OpenClaw split-brain

Evidence:
- `packages/sdkwork-claw-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`

Current state:

- hosted manage routes and desktop direct flows now share the same supervisor-backed runtime authority in desktop combined mode
- focused server-host tests and broader `check:server` verification pass on the corrected contract

### 2. Resolved: hosted readiness no longer overstates runtime health

Evidence:
- `packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs`
- `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
- `scripts/sdkwork-host-runtime-contract.test.ts`

Current state:

- hosted readiness now requires a ready host lifecycle, ready OpenClaw runtime, ready OpenClaw gateway, a live `local-built-in` projection, and non-empty `baseUrl`/`websocketUrl`
- bootstrap blocks on real runtime readiness instead of endpoint count alone

### 3. Resolved: hosted desktop manage gateway invoke is no longer a dead stub

Evidence:
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-claw-server/src-host/src/main.rs`

Current state:

- hosted desktop gateway invoke now routes through the same supervisor-backed OpenClaw control path used by desktop direct flows
- parity tests for the hosted manage plane are present and passing

### 4. Resolved: desktop startup fail-fast behavior is materially stronger

Evidence:
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

Current state:

- bundled install sync and bundled OpenClaw activation failures now fail bootstrap instead of being silently tolerated
- desktop runtime readiness faults surface before the React shell pretends startup succeeded

### 5. Resolved: server/container hosted surfaces no longer fake built-in writable ownership

Evidence:
- `packages/sdkwork-claw-host-studio/src-host/src/lib.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs`
- `packages/sdkwork-claw-server/src-host/src/http/routes/health.rs`

Current state:

- inactive server/container control planes no longer expose `local-built-in` as a writable managed workbench
- public server workbench mutation routes now reject unsupported built-in mutations with an explicit conflict contract
- readiness now reflects runtime truth rather than constant route availability

### 6. Resolved: hosted/browser managed OpenClaw config mutation flows are now gateway-first when the runtime is online

Evidence:
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`
- `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- `packages/sdkwork-claw-instances/src/services/instanceService.test.ts`

Current state:

- raw config load/save already used gateway authority when a live managed gateway existed
- the remaining config-backed mutations now follow the same rule for:
  - agent create/update/delete
  - channel config save
  - web search config save
  - auth cooldown config save
  - channel enabled toggle
- platform file I/O remains as an offline desktop fallback only

### 7. Resolved: hosted conversation and deployment readiness truth are now materially converged

Evidence:
- `packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts`
- `deploy/kubernetes/templates/deployment.yaml`
- `deploy/kubernetes/values.yaml`
- `scripts/release-deployment-contract.test.mjs`

Current state:

- hosted/browser managed OpenClaw conversation lists no longer fall back to stale snapshot truth when runtime authority is unavailable
- kubernetes readiness now targets `/claw/health/ready`
- unsupported multi-replica deployment is explicitly rejected

## Remaining Findings

### 1. Medium: `desktop_host.enabled` is still a pseudo-option rather than a truthful supported mode

Evidence:
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

What is happening:

- Rust bootstrap still allows the embedded desktop host to be disabled through config
- renderer startup and bridge code still treat the canonical hosted runtime as required desktop infrastructure
- if the host is disabled, the current renderer path still collapses into a missing-runtime failure rather than a clearly supported degraded mode

Why it matters:

- the config surface still implies an optional host mode that the frontend does not actually honor
- this is now more of a contract hygiene problem than a broad runtime-authority failure, but it should not ship as an ambiguous switch

Required direction:

- either remove the pseudo-option and make desktop hosted mode mandatory
- or implement a full renderer degradation path that avoids hosted runtime probing when the host is disabled

### 2. Medium: release evidence is stronger, but real packaged/manual runtime proof is still external to this sandbox

Evidence:
- `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md`
- `docs/core/release-and-deployment.md`
- `scripts/check-release-closure.mjs`

What is happening:

- the release flow now requires documented smoke evidence and the unified host runtime contract suite
- the current workspace still cannot produce trustworthy desktop-installer, docker-runtime, or live-kubernetes manual proof inside this sandbox

Why it matters:

- automated contracts now protect the architecture far better than before
- release readiness still needs real installer/runtime execution on actual target environments before calling the system fully proven

Required direction:

- run the manual checklist from the smoke report on packaged desktop targets and live container targets
- persist screenshots, endpoint traces, or installer/runtime logs as release evidence

## Current Architecture Status

The current system now has:

- one shared Rust kernel
- one mostly converged runtime authority model across desktop, server, docker, and kubernetes
- one materially truthful readiness contract
- one shared instance/config/chat/task surface that now respects runtime authority more consistently
- one stronger automated smoke and release-closure loop

It does not yet have:

- a truthful supported story for `desktop_host.enabled = false`
- attached real-environment runtime evidence for packaged desktop, docker, and singleton-kubernetes release flows

## Recommended Next Sequence

Priority order:

1. P1: decide the product contract for `desktop_host.enabled`
2. P1: execute the manual smoke checklist on real packaged desktop, docker, and singleton-kubernetes targets
3. P1: persist release evidence artifacts so closure is not only doc-backed but environment-backed

## Bottom Line

The earlier review is no longer an accurate picture of the runtime. The major runtime-authority defects it identified have been closed in code and locked by tests. The remaining work is narrower: finish the desktop host mode contract decision, then collect real packaged/manual runtime evidence outside this sandbox.

