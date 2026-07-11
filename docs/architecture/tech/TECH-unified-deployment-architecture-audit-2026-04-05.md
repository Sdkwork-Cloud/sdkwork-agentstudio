> Migrated from `docs/reports/unified-deployment-architecture-audit-2026-04-05.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Deployment Architecture Audit

Date: 2026-04-05

Scope:
- `server`
- `desktop`
- `docker`
- `kubernetes`
- shared browser-hosted `/claw/*` architecture
- instance lifecycle, instance detail/load projection, and instance removal semantics

## Executive Summary

The workspace has unified route families and host-mode metadata, but it does not yet provide unified runtime semantics. The current implementation can report instance lifecycle changes that never happened, rewrite remote instance endpoints into incorrect local projections, and apply different destructive delete behavior depending on host mode. As a result, startup, load, and remove flows cannot currently guarantee correctness across `desktop`, `server`, `docker`, and `kubernetes`.

The main architectural issue is that the codebase mixes three different concerns into one instance record:

1. observed runtime state
2. control capability
3. editable configuration projection

That blending causes server-backed and custom instances to look app-managed even when the host has no real process controller for them.

## Status Refresh

The findings section below preserves the original audit snapshot. It is no longer the latest implementation status.

Closed in the latest hardening pass:
- lifecycle mutations no longer fake success for unsupported runtimes; unsupported `start / stop / restart` now return `409 studio_public_api_lifecycle_unavailable`, and the React surfaces gate lifecycle actions from backend capability truth
- server-host custom endpoint normalization now preserves explicit `baseUrl`, `websocketUrl`, deployment metadata, and default-instance intent instead of rewriting remote operator configuration into local projections
- managed workbench inference no longer trusts `deploymentMode = local-managed` alone; explicit `workbenchManaged`, `lifecycleControllable`, and managed config routes now drive control-plane truth
- desktop and server delete semantics are aligned so shared conversations survive instance removal when other participant instances remain
- server and desktop detail payloads now carry explicit capability truth including `lifecycleControllable`, `workbenchManaged`, and `endpointObserved`
- desktop detail no longer reads the built-in OpenClaw config for arbitrary custom `local-managed` OpenClaw instances
- hosted desktop browser mode now resolves the canonical runtime descriptor before building hosted `/claw/*` surfaces, and the startup-critical hosted routes return the required CORS headers for browser-session preflight and fetch flows
- `InstanceDetail` now treats Provider Center managed directory routes as read-only provider surfaces, so the UI no longer exposes editable provider controls that the service layer will always reject
- pure service entrypoints have been split from runtime barrels where needed, removing the `react/index.js` contamination that previously broke several Node-only instance service tests

Currently verified remaining gaps:
- workspace-wide `pnpm.cmd lint` now completes successfully in this sandbox; focused TypeScript and Rust regression suites are also green
- remote OpenClaw provider catalog structural mutations are still intentionally unavailable in instance detail; editing an existing provider config is supported, but `create / delete provider` and `create / delete model` stay disabled until the shared service contract grows a truthful mutation surface
- full installer artifact validation across packaged Windows / macOS / Linux outputs still needs end-to-end execution outside the current sandbox, because this workspace session cannot produce and launch signed installers for every platform

## Findings

### 1. Critical: lifecycle actions are synthetic for most non-built-in instances

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:1770`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:1822`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:1864`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:992`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:998`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:1004`

What happens:
- Desktop only performs real process control for the built-in local-managed OpenClaw instance.
- For every other desktop instance, `start/stop/restart` only mutate stored `status`.
- The shared server provider for `server / docker / kubernetes` also implements `start/stop/restart` as a plain status update.

Why this is a bug:
- The API contract implies a real lifecycle operation.
- The host does not verify process creation, readiness, health, or shutdown for those instances.
- UI and automation can receive `"online"` or `"offline"` even when nothing changed in the actual runtime.

Impact:
- startup correctness is not guaranteed
- test/load flows can pass against fake status
- remove and follow-up operations can run against nonexistent runtimes

Required fix:
- Split lifecycle into `observedState` and `controlCapability`.
- Only expose lifecycle mutations for instances with a real controller.
- For unsupported modes, return a capability-disabled response instead of mutating status.
- After every real lifecycle operation, re-read verified runtime state before returning success.

### 2. Critical: server normalization corrupts remote instance truth

Evidence:
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:438`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:483`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:492`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:499`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:575`

What happens:
- Custom instances default to `deploymentMode = "local-managed"` when missing.
- Custom instances force `port = config_port`.
- Custom instances force `baseUrl = http://{host}:{config_port}`.
- Custom instances force `websocketUrl = ws://{host}:{config_port}` when websocket is assumed.
- Custom instances force `isDefault = false`.

Why this is a bug:
- Reverse proxies, ingress paths, HTTPS, non-root prefixes, and externally published ports are lost.
- `docker` and `kubernetes` deployments are especially vulnerable because the published browser endpoint often differs from container bind settings.
- The server host rewrites operator intent instead of projecting stored truth.

Impact:
- wrong links in detail pages
- wrong connectivity targets
- broken remote health/debug flows
- impossible to preserve a user-selected default custom instance

Required fix:
- Preserve explicit `baseUrl`, `websocketUrl`, `port`, `deploymentMode`, and `isDefault`.
- Only derive missing values, never overwrite explicit remote endpoints.
- Treat URL scheme, host, port, and path as operator-owned configuration.

### 3. High: server host can misclassify custom instances as managed OpenClaw workbenches

Evidence:
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:442`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:765`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:901`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:1114`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:1827`

What happens:
- Managed workbench eligibility is inferred from:
  - `runtimeKind == "openclaw"`
  - `deploymentMode == "local-managed"`
- The server normalizer defaults missing custom `deploymentMode` to `local-managed`.
- `instance_workbench(...)` then creates or synchronizes a managed workbench snapshot.
- Task, file, provider-config, and execution APIs operate on that synthesized snapshot.

Why this is a bug:
- A server-backed custom instance can be treated as a locally managed OpenClaw workspace without a real local controller.
- The host begins exposing workbench management surfaces that it does not actually own.

Impact:
- false-positive management UI
- fake task/file/provider operations
- architecture drift between desktop real control and server synthetic control

Required fix:
- Replace inference with an explicit `workbenchManaged` capability.
- Only create managed workbench state when a host-specific controller exists.
- Reject workbench mutations for discovery-only instances.

### 4. High: delete semantics are inconsistent across desktop and server

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:1690`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:1740`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:962`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:975`

What happens:
- Desktop removes the deleted instance from conversations, reassigns `primary_instance_id` when possible, and only deletes a conversation if no participant remains.
- Server deletes every conversation that references the removed instance at all.

Why this is a bug:
- The same API operation has different destructive side effects by host mode.
- Users moving between `desktop` and `server / docker / kubernetes` cannot predict data retention behavior.

Impact:
- avoidable conversation loss
- impossible semantic parity across modes
- migration and cross-mode QA become unreliable

Required fix:
- Define one canonical delete policy.
- Apply the same conversation rewrite/removal algorithm in all providers.
- Add parity tests for delete behavior.

### 5. High: server instance detail overstates control and mutability

Evidence:
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:805`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:807`
- `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs:808`

What happens:
- `configWritable` is hardcoded to `true`.
- `startStopSupported` is inferred only from `deploymentMode == "local-managed"`.
- `owner` is only split between `remoteService` and `appManaged`.

Why this is a bug:
- Mutability and lifecycle control are capability questions, not just deployment-mode labels.
- A projected detail record can advertise writable/manageable behavior that the host cannot fulfill.

Impact:
- incorrect UI affordances
- unsafe edit flows
- misleading automation assumptions

Required fix:
- Compute lifecycle and editability from explicit capability flags.
- Include at least:
  - `lifecycleControllable`
  - `configWritable`
  - `workbenchManaged`
  - `endpointObserved`

### 6. Medium: desktop built-in instance status can go stale

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:2457`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:4487`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:4549`

What happens:
- `build_built_in_instance(...)` seeds the built-in status as `Offline`.
- `upsert_built_in_instance(...)` preserves stored `status`, `updated_at`, and `last_seen_at`.
- `load_instance_registry(...)` does not re-derive built-in status from the live supervisor/control plane before returning the list.

Why this is a bug:
- The built-in instance is the one runtime the desktop host actually controls, so its list status should come from live runtime state.
- After crashes, manual restarts, or recovery flows, the registry can show stale lifecycle data.

Impact:
- stale list/detail state
- inconsistent operator trust in built-in runtime health

Required fix:
- Derive built-in list status from live supervisor/control-plane state on every load.
- Persist historical fields separately from live lifecycle projection.

### 7. Medium: desktop detail can read the built-in OpenClaw config for any local-managed OpenClaw instance

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs:2277`

What happens:
- `get_instance_detail(...)` loads `paths.openclaw_config_file` for every instance where:
  - `runtime_kind == Openclaw`
  - `deployment_mode == LocalManaged`

Why this is a bug:
- That logic is not restricted to the built-in default instance.
- If custom local-managed OpenClaw instances are allowed, their detail/connectivity projection can accidentally use the built-in config file.

Impact:
- wrong detail endpoint projection
- wrong config-derived diagnostics
- impossible multi-runtime correctness

Required fix:
- Restrict built-in config reads to the built-in instance id.
- For custom local-managed runtimes, use instance-owned config sources only.

### 8. Medium: frontend lifecycle UX trusts status instead of capabilities

Evidence:
- `packages/sdkwork-agentstudio-pc-instances/src/pages/Instances.tsx:584`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/Instances.tsx:608`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx:1575`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx:4238`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.ts:558`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceManagementPresentation.ts:164`

What happens:
- List and detail pages expose `start/stop/restart` mostly from `status`.
- Service methods treat any non-null response as success.
- Management-scope presentation trusts `configWritable`, which is already overstated by the server provider.

Why this is a bug:
- UI is not capability-driven.
- A synthetic backend lifecycle update becomes a user-visible success path.

Impact:
- false confidence during operations
- broken cross-mode expectations
- no safe read-only posture for server-backed discovery instances

Required fix:
- Gate buttons from detail capabilities, not from coarse status.
- After lifecycle actions, reload detail and verify a real state transition before showing success.
- Render read-only states explicitly.

### 9. Medium: current docs and contract tests freeze topology, not behavior

Evidence:
- `docs/guide/application-modes.md:65`
- `docs/guide/application-modes.md:73`
- `scripts/sdkwork-host-runtime-contract.test.ts:132`

What happens:
- Documentation correctly states that `container` and `kubernetes` are deployment shapes around the same server binary.
- The contract test validates route families and host-mode metadata.
- Neither the docs nor the contract test freeze semantic parity for lifecycle, delete behavior, endpoint preservation, or workbench eligibility.

Why this is a bug:
- Semantic drift can ship while topology checks still pass.
- The current architecture guardrail is too shallow for the problem the product now needs to solve.

Impact:
- regressions appear "architecturally compliant"
- deployment-mode parity keeps drifting unnoticed

Required fix:
- Add semantic parity tests across desktop and server providers.
- Document canonical behavior for lifecycle, delete, endpoint projection, and workbench management.

## Open Questions

1. Are custom non-built-in `local-managed` OpenClaw instances an intentional supported product shape?
2. Should `server / docker / kubernetes` ever own instance process lifecycle directly, or should they stay read-only until a real deployment controller exists?
3. Should instance deletion preserve conversations whenever at least one participant remains, or is destructive delete the intended product rule?

## Improvement Plan

### Phase 1: freeze the canonical instance contract

Define one source of truth for:
- observed lifecycle state
- control capability
- config mutability
- endpoint projection ownership
- workbench management eligibility
- conversation behavior on instance deletion

Deliverable:
- an ADR or contract doc that all providers implement

### Phase 2: harden provider behavior

Desktop provider:
- derive built-in lifecycle from live supervisor state on every registry load
- restrict built-in config access to the built-in instance id
- return capability-disabled results for non-app-managed instances instead of mutating status

Server provider:
- preserve explicit endpoint and default-instance fields
- stop defaulting custom instances to `local-managed`
- replace synthetic lifecycle mutations with unsupported capability responses unless a real controller exists
- only create managed workbenches for explicitly host-managed instances
- unify delete semantics with the canonical policy

### Phase 3: make the frontend capability-driven

- hide or disable `start/stop/restart` unless `lifecycleControllable == true`
- separate "runtime observed online" from "this host can control it"
- verify post-action state by refetching instance detail
- render discovery-only instances as read-only, not partially managed

### Phase 4: add semantic parity tests

Add test coverage for:
- lifecycle actions on built-in, local-external, remote, and server-projected instances
- endpoint preservation for HTTPS, non-root paths, ingress, and reverse-proxy URLs
- default-instance persistence
- workbench eligibility
- delete-instance conversation rewrite behavior
- detail capability projection parity across desktop and server

### Phase 5: deployment-mode validation matrix

Validate the same scenarios in:
- desktop combined mode
- bare-metal server mode
- docker deployment
- kubernetes deployment

Minimum required scenarios:
- startup
- readiness observation
- instance detail load
- lifecycle control exposure
- conversation retention after instance removal
- workbench/task/file/provider mutation eligibility

## Recommended Implementation Order

1. Freeze contract semantics in docs and tests.
2. Fix server projection normalization and workbench eligibility.
3. Remove synthetic lifecycle mutations from unsupported modes.
4. Unify delete semantics.
5. Fix desktop built-in live-status projection.
6. Switch frontend to capability-driven actions.
7. Run the full deployment validation matrix.

## Verification Notes

Attempted command:
- `pnpm.cmd exec tsx scripts/sdkwork-host-runtime-contract.test.ts`

Current local result:
- could not run because `tsx` is not available in the current workspace toolchain

This audit is therefore based on source inspection and runtime-contract review, not on a completed automated test execution.

## Implementation Progress

### 2026-04-05 follow-up hardening

Implemented:
- server-host studio provider now preserves remote custom endpoint truth, normalizes unique default-instance selection, rejects synthetic lifecycle mutations, and preserves shared conversations when deleting instances that still have other participants
- shared `/claw/*` router now applies a canonical CORS transport layer for hosted-browser startup flows, including `OPTIONS` preflight support and actual-response `Access-Control-Allow-Origin` headers for desktop embedded-host probes against `host-platform`, `host-endpoints`, and `studio/instances`
- public studio lifecycle mutation routes now map unsupported lifecycle control to a capability/state error contract (`409 studio_public_api_lifecycle_unavailable`) instead of a generic `500`, so server-backed and discovery-only instances fail explicitly rather than looking like an internal crash
- instance service now checks `detail.lifecycle.startStopSupported` before invoking `start/stop/restart`, so server-projected and discovery-only instances do not attempt unsupported lifecycle control
- instance detail header now hides lifecycle actions unless the backend detail explicitly advertises lifecycle support
- instances list now preloads lifecycle capability per instance and withholds `start/stop/restart` controls until support is confirmed
- desktop hosted runtime resolution now retries short-lived `null` descriptors during startup and falls back to the last successful descriptor when refreshes transiently fail
- desktop studio list/get/detail now have supervisor-backed projection paths for Tauri commands and the embedded host bridge, so the built-in OpenClaw instance reflects live supervisor lifecycle instead of stale registry status
- built-in runtime projection now refreshes the built-in instance endpoint/auth surface from the configured supervisor runtime while keeping registry history as the persistent source of record
- non-default `localManaged + openclaw` instance detail no longer reuses the built-in managed OpenClaw config file for connectivity or configuration data-access projection
- built-in-only workbench/config ownership is now explicitly restricted to the default built-in instance instead of every `localManaged` OpenClaw record
- desktop lifecycle/detail capability projection now treats non-built-in `localManaged` OpenClaw records as external/local metadata entries, so they no longer advertise built-in lifecycle control or config mutability
- shared lifecycle snapshots now expose explicit capability truth via:
  - `lifecycleControllable`
  - `workbenchManaged`
  - `endpointObserved`
- server-host detail projection now reports built-in OpenClaw as `workbenchManaged=true` and `endpointObserved=true` while keeping lifecycle control disabled, and it now reports custom `local-managed` OpenClaw instances as external metadata-only entries instead of synthetic managed workbenches
- browser fallback (`webStudio`) now keeps the built-in OpenClaw workbench managed but no longer claims lifecycle control, and it no longer synthesizes a managed workbench for custom `local-managed` OpenClaw entries
- management-scope presentation is now capability-driven; it no longer treats raw `configWritable` as proof of runtime control and instead distinguishes managed workbench control from remote console/config surfaces
- node inventory topology classification has been extracted into a pure shared helper, and custom non-built-in `local-managed` metadata runtimes no longer get misclassified as `managedRemote`; they now project as attached external nodes unless the host has explicit managed-runtime evidence
- `@sdkwork/agentstudio-pc-infrastructure` no longer re-exports `@sdkwork/agentstudio-pc-i18n` from its root barrel, so hosted desktop/browser platform tests can execute without dragging React/i18n into pure transport/runtime validation paths
- `instanceService` has been split into:
  - `instanceServiceCore.ts` for pure lifecycle/config/provider logic with explicit dependency injection
  - `instanceService.ts` as a thin runtime wrapper that binds `studio`, `openClawGatewayClient`, and `openClawConfigService`
- `nodeInventoryService` has been split into:
  - `nodeInventoryServiceCore.ts` for pure topology/session projection logic
  - `nodeInventoryService.ts` as the runtime wrapper over `kernelPlatformService`, `hostPlatformService`, and `studio`
- `sdkwork-instances` contract tests now validate the service wrapper and pure core together instead of freezing implementation details to a single file, so architecture-preserving refactors no longer register as false regressions
- instance-service test fixtures now project built-in `local-managed` OpenClaw with explicit lifecycle capability truth (`workbenchManaged`, `endpointObserved`, `lifecycleControllable`) instead of relying on stale implicit defaults

Verified:
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml desktop_combined_hosted_startup_ -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml public_studio_instance_mutation_routes_preserve_custom_instance_mutations_and_reject_unsupported_lifecycle_control -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml default_provider_ -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml custom_local_managed_openclaw_detail_does_not_read_built_in_managed_config -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml built_in_instance_detail_ -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml embedded_host_server::tests::desktop_backend_ -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml embedded_host_server_handle_reports_ready_status_after_startup -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_ -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml zeroclaw_remote_instance_detail_reports_external_lifecycle_and_dashboard_endpoint -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml custom_local_managed_openclaw_detail_ -- --nocapture`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceManagementPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/agentWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/agentSkillManagementService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/nodeInventoryService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/nodeInventoryTopology.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`

Current local environment blockers:
- the targeted `react` `EPERM` blocker has been removed for `desktopHostedBridge`, `instanceService`, `nodeInventoryService`, `instanceWorkbenchService`, `agentWorkbenchService`, and `agentSkillManagementService` by moving pure logic off package-root barrels
- additional semantic hardening is now in place on the instance stack: `openClawManagementCapabilities`, `instanceManagementPresentation`, `instanceServiceCore`, and registry-backed `instanceWorkbenchServiceCore` no longer treat `deploymentMode = local-managed` as sufficient proof of managed control
- `InstanceDetail.tsx` now gates managed config editing surfaces with explicit `detail.lifecycle.configWritable` instead of treating any attached managed-config path as writable
- the remaining local verification blocker is environment-specific: `pnpm lint` still fails on this machine because Node cannot open `node_modules/.pnpm/typescript@6.0.2/node_modules/typescript/lib/tsc.js` and raises `EPERM` before workspace TypeScript checking can complete

Recommended next implementation slice:
- add a deployment-mode smoke matrix for desktop/server/docker/k8s startup, readiness, instance detail load, hosted-browser bootstrap, CORS preflight, and lifecycle capability exposure
- extend host/runtime parity checks so registry-backed and discovery-only instances cannot accidentally reintroduce writable-management affordances through fallback detail projections
- keep package-root barrels free of unrelated UI/i18n exports on pure runtime/service paths, and add contract coverage so future root-entry pollution is caught before it reintroduces the Node `react` `EPERM` failure mode

