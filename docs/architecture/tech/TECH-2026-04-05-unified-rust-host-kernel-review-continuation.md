> Migrated from `docs/reports/2026-04-05-unified-rust-host-kernel-review-continuation.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Rust Host Kernel Review Continuation

Date: 2026-04-05

Scope:
- desktop embedded host
- standalone server host
- docker deployments built on the shared server host
- kubernetes deployments built on the shared server host
- shared hosted browser bootstrap, runtime descriptor, and host-platform contracts

## Executive Summary

The shared Rust host kernel has improved materially in this pass. The highest-risk desktop hosted-runtime failure mode identified in the follow-up review is now closed in code:

- desktop hosted runtime resolution no longer silently reuses stale `browserBaseUrl` and browser-session tokens across refresh failures
- server HTML metadata injection now escapes dynamic values instead of writing raw control-plane values directly into `<meta>` attributes
- host platform `version` now exposes a real package version for the shared Rust host kernel instead of a pseudo-label such as `desktop@package-name`
- host platform capability truth now distinguishes static support from live runtime availability while preserving a compatibility `capabilityKeys` field
- hosted browser bootstrap now has a structured descriptor endpoint and no longer needs HTML meta scraping as the primary startup contract
- desktop OpenClaw supervisor startup no longer treats a merely listening TCP port as proof that `/tools/invoke` is actually ready
- deployment docs now explicitly separate source-tree templates from extracted bundle runtime paths
- the container image now exposes a native `HEALTHCHECK` against `/claw/health/ready`
- docker and singleton-k8s smoke evidence now have a persisted deployment bootstrap report instead of existing only as review TODOs
- the desktop hosted studio bridge now reuses the shared deferred hosted adapter instead of maintaining a second manual hosted-fetch implementation

These changes reduce the likelihood of the exact failure chain that previously surfaced as:

- `resolveHostedBasePath` failures
- `ERR_CONNECTION_REFUSED`
- hosted startup fetch failures after embedded host restart, rebind, or token change

This continuation is no longer limited to hosted-runtime bootstrap hardening. The shared host kernel now also closes two contract problems that were still causing drift across server and desktop embedded-host surfaces:

- desktop combined mode now forcibly normalizes `desktop_host.enabled` back to the canonical embedded-host-on contract
- canonical read-only host resources no longer rewrite `updatedAt` / `generatedAt` on every unchanged poll
- host platform capability surfaces no longer over-claim live gateway invocation authority when the bound provider/runtime is not actually ready
- hosted browser bootstrap/session discovery now has a structured JSON descriptor path across standalone server and desktop embedded-host runtimes
- release/deployment validation now guards source-vs-bundle path semantics and the docker/k8s smoke evidence contract
- desktop supervisor startup now waits for authenticated OpenClaw HTTP invoke readiness instead of only checking loopback port acceptability

## Changes Landed In This Pass

### 1. Desktop hosted runtime resolver no longer revives stale descriptors

Files:
- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostRuntimeResolver.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`

What changed:

- resolver still deduplicates concurrent loads and still retries within one resolution window
- resolver no longer falls back to the last successful runtime descriptor when a later refresh returns `null` or throws
- refresh failure now resolves to `null`, forcing upper layers to re-probe live runtime truth instead of using dead ports or stale browser-session tokens

Why it matters:

- this closes a concrete restart/rebind/token-rotation hazard in desktop hosted mode
- it directly improves startup correctness for the embedded OpenClaw host path

### 2. Server-host HTML metadata injection now escapes dynamic values

Files:
- `packages/sdkwork-clawstudio-server/src-host/src/http/static_assets.rs`

What changed:

- added HTML attribute escaping for:
  - browser session token
  - accelerator profile
  - deployment family
  - API/manage/internal base paths
  - host/distribution metadata

Why it matters:

- raw dynamic values no longer break `<meta>` attribute structure
- the current HTML bootstrap transport is still not the ideal long-term control-plane contract, but it is now materially safer and less fragile

### 3. Host platform version now reports a real package version

Files:
- `packages/sdkwork-clawstudio-host-core/src-host/src/lib.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/main.rs`

What changed:

- `HostCoreMetadata` now exposes `package_version`
- server hosted host-platform status now returns the shared Rust host-core package version
- desktop hosted host-platform status now returns the same version contract
- server test coverage now asserts the real version field instead of a synthetic `desktop@...` prefix

Why it matters:

- discovery, diagnostics, and runtime reviews now receive a real version value
- the contract is more stable for automation, release evidence, and compatibility checks

### 4. Desktop embedded host opt-out is now closed as a pseudo-mode

Files:
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/config.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

What changed:

- desktop config normalization now forces `desktop_host.enabled = true`
- persisted config writes serialize the normalized contract instead of preserving a stale disabled value
- embedded host bootstrap no longer returns an empty host runtime when the config tries to disable it

Why it matters:

- desktop combined mode now has one truthful contract instead of a fake optional branch
- renderer startup, embedded host bootstrap, and packaged-host expectations are aligned again

### 5. Stable host-resource timestamps now stop drifting across unchanged reads

Files:
- `packages/sdkwork-clawstudio-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/internal_node_sessions.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/api_public.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/openapi.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/manage_openclaw.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/main.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/embedded_host_server.rs`

What changed:

- `ServerState` now tracks a dedicated stable resource-projection timestamp
- the server host now uses that stable timestamp for:
  - `/claw/internal/v1/host-platform`
  - `/claw/api/v1/discovery`
  - `/claw/openapi/discovery`
  - `/claw/manage/v1/openclaw/runtime`
  - `/claw/manage/v1/openclaw/gateway`
- request/operation timestamps for live node-session mutations and error envelopes remain request-time values
- the desktop embedded-host OpenClaw provider now honors the requested projection timestamp instead of silently replacing it with its own wall-clock time

Why it matters:

- unchanged host resources no longer look mutated on every poll
- reconciliation, startup probing, cache validation, and browser-host convergence now have a stable resource-time contract
- desktop embedded host and standalone server host now follow the same projection-time semantics for canonical read-only OpenClaw surfaces

### 6. Host platform capabilities now separate supported surface from live availability

Files:
- `packages/sdkwork-clawstudio-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/internal_node_sessions.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/http/routes/openapi.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/main.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/embedded_host_server.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/internal.ts`

What changed:

- server host-platform status now publishes:
  - `supportedCapabilityKeys`
  - `availableCapabilityKeys`
- compatibility `capabilityKeys` now intentionally mirrors `availableCapabilityKeys`
- standalone server mode still advertises `manage.openclaw.gateway.invoke` as a supported capability, but it is removed from the live available set when the bound control-plane provider cannot currently execute it
- desktop combined mode now removes `manage.openclaw.gateway.invoke` from live availability whenever either:
  - the embedded desktop host is not yet ready
  - the managed OpenClaw gateway lifecycle is not ready
- the OpenAPI schema and TypeScript internal contract now expose the same split surface

Why it matters:

- upper layers can distinguish discovery/build support from runtime authority
- desktop bootstrap, instance actions, and hosted runtime checks no longer need to trust a mode-derived capability list
- the compatibility field remains safe for older consumers because it now reflects live truth instead of a compile-time superset

### 7. Hosted browser bootstrap now prefers a structured descriptor endpoint

Files:
- `packages/sdkwork-clawstudio-server/src-host/src/http/static_assets.rs`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/index.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/index.ts`
- `packages/sdkwork-clawstudio-core/src/platform/index.ts`
- `packages/sdkwork-clawstudio-shell/src/application/bootstrap/bootstrapShellRuntime.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

What changed:

- server and desktop embedded-host roots now expose `/sdkwork-clawstudio-bootstrap.json`
- the structured descriptor publishes:
  - host mode
  - distribution/deployment family
  - accelerator profile
  - API/manage/internal base paths
  - browser session token
- shell bootstrap now awaits structured hosted-browser bridge bootstrap instead of wiring the bridge exclusively from HTML meta tags
- the infrastructure browser bridge can now bootstrap successfully even when HTML meta tags are absent, as long as the structured descriptor endpoint is present
- desktop embedded-host integration tests now acquire the browser session token through the structured descriptor rather than scraping the root HTML

Why it matters:

- browser-host startup no longer depends on ad hoc DOM metadata parsing as the canonical control-plane transport
- desktop embedded-host and standalone server host now expose the same structured bootstrap contract
- HTML metadata can remain a compatibility fallback instead of the primary source of truth

### 8. Deployment bootstrap contracts now distinguish source templates, packaged bundles, and runtime health evidence

Files:
- `deploy/docker/README.md`
- `docs/core/release-and-deployment.md`
- `deploy/docker/Dockerfile`
- `scripts/release-deployment-contract.test.mjs`
- `scripts/package-release-assets.test.mjs`
- `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md`

What changed:

- docker deployment docs now state explicitly that repository review happens under `deploy/docker/*`, while runnable bundle commands execute from the extracted bundle root under `deploy/*`
- package-release contract coverage now preserves that same README contract inside the emitted container bundle, so reviewers and operators see the same path semantics
- the container image now installs `curl` and publishes a native `HEALTHCHECK` against `http://127.0.0.1:18797/claw/health/ready`
- deployment contract tests now require:
  - source-tree vs bundle-path separation
  - docker image health alignment
  - persisted packaged-image, docker compose, and singleton-k8s smoke commands
- a new persisted smoke report now records the required runtime-backed evidence contract for:
  - packaged container image startup
  - docker compose startup
  - singleton-k8s readiness

Why it matters:

- code review no longer has to infer whether `deploy/docker/*` is runnable as-is or only after packaging transforms
- the docker image, helm chart, and Rust readiness route now point at the same truthful readiness surface
- release sign-off now has an explicit deployment smoke evidence template even when live docker/k8s execution still has to happen outside this sandbox

### 9. Desktop hosted studio bridge now reuses one deferred hosted adapter contract

Files:
- `packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.test.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`

What changed:

- `tauriBridge.ts` no longer hand-builds a second `WebHostedStudioPlatform` configuration for hosted desktop studio traffic
- the desktop bridge now delegates hosted studio transport to `createDeferredDesktopHostedStudioPlatform(...)`
- focused desktop tests now prove that deferred hosted studio requests refresh both:
  - `browserBaseUrl`
  - `browserSessionToken`
  after runtime descriptor changes

Why it matters:

- the desktop hosted auth/bootstrap path now has one shared implementation for deferred hosted studio routing instead of two almost-identical code paths
- restart/rebind safety is less likely to regress because token refresh and base-path refresh now live under one helper contract
- this closes another place where `resolveHostedBasePath`-style regressions could have reappeared through drift rather than through an explicit product bug

### 10. Desktop supervisor now waits for OpenClaw invoke readiness instead of raw TCP listen

Files:
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/supervisor.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs`

What changed:

- supervisor startup readiness now probes authenticated `POST /tools/invoke` with the built-in gateway token and the `health` tool payload
- the managed gateway is only marked running after the invoke surface returns an HTTP success instead of merely accepting a TCP socket
- desktop kernel service tests and supervisor tests now use HTTP-capable fake gateway runtimes rather than bare TCP listeners
- supervisor gateway test fixtures now reserve unique loopback ports so concurrent Rust test execution does not create false failures through port collisions

Why it matters:

- this closes the startup race where desktop marked the built-in OpenClaw instance `online` before the gateway API was actually serving requests
- it directly addresses the failure shape previously observed as:
  - `503 Service Unavailable` on `/claw/api/v1/studio/instances/local-built-in/gateway/invoke`
  - empty file, memory, or task workbench sections caused by premature gateway calls
  - early WebSocket connection failures against the built-in OpenClaw endpoint
- desktop combined mode now has a more truthful bridge between supervisor lifecycle, instance status, and actual OpenClaw runtime readiness

## Verification Evidence

Commands executed in this pass:

- `node --experimental-strip-types packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.test.ts`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml inject_server_host_metadata_escapes_dynamic_metadata_values`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml static_assets`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml internal_host_platform_route_reports_desktop_identity_in_desktop_combined_mode`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml host_platform_status_matches_desktop_combined_capability_contract`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml internal_host_platform_route_keeps_updated_at_stable_across_unchanged_reads`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml public_api_discovery_route_keeps_generated_at_stable_across_unchanged_reads`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml openapi_discovery_route_keeps_generated_at_stable_across_unchanged_reads`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml manage_openclaw_runtime_route_keeps_updated_at_stable_across_unchanged_reads`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml embedded_host_manage_openclaw_provider_honors_requested_projection_timestamp`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml embedded_host_server_state_binds_manage_openclaw_provider_to_live_supervisor_runtime`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml internal_host_platform_route_reports_complete_manage_capabilities_in_server_mode`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml internal_host_platform_route_omits_manage_service_capabilities_in_desktop_combined_mode`
- `cargo test --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml openapi_v1_document_describes_host_platform_state_store_driver`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml host_platform_status_matches_desktop_combined_capability_contract`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml host_platform_status_excludes_gateway_invoke_from_available_capabilities_when_runtime_is_not_ready`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_canonical_server_route_families`
- `node scripts/release-deployment-contract.test.mjs`
- `node scripts/package-release-assets.test.mjs`
- `node --experimental-strip-types packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml supervisor_waits_for_gateway_http_invoke`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --lib supervisor_`
- `pnpm.cmd check:release-flow`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd lint`

Observed result:

- all commands above passed
- the desktop Tauri test run completed successfully, with one non-fatal incremental compilation warning on Windows (`os error 5`) during finalize cleanup

## Active Findings Still Remaining

### 1. Release sign-off still needs real packaged/manual runtime evidence

Evidence:
- `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md`
- `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md`
- `docs/core/release-and-deployment.md`

Current state:

- automated proof is much better
- deployment path semantics, image-native health, and docker/k8s smoke command surfaces are now explicit and regression-tested
- real installer, docker runtime, and live single-replica k8s smoke proof still cannot be completed inside this sandbox

Required direction:

- run packaged desktop installer smoke
- run docker smoke against the same shared server host kernel
- run singleton-k8s smoke with persisted release evidence

## Recommended Next Implementation Order

1. Execute packaged/manual smoke on desktop, docker, and singleton-k8s targets and persist artifacts.

## Recommended Test Plan

### Desktop

- startup after embedded host restart
- startup after dynamic port rebind
- startup after browser-session token rotation
- hosted OpenClaw bootstrap after app relaunch

### Server / Docker / Kubernetes

- verify capability projections for:
  - inactive OpenClaw provider
  - degraded OpenClaw provider
  - ready OpenClaw provider
- verify singleton-k8s readiness continues to target `/claw/health/ready`

### Release / Packaging

- verify installer-time OpenClaw extraction leaves no first-start extraction work
- verify packaged desktop startup reaches ready OpenClaw runtime without hosted fetch failures
- capture logs and screenshots for:
  - built-in instance availability
  - OpenClaw control console
  - chat and instance detail runtime paths

## Bottom Line

This continuation pass closed three real contract gaps that were still leaking instability into the shared host architecture:

- stale desktop hosted runtime descriptor reuse
- raw HTML metadata injection
- fake host version values
- implicit deployment-path semantics across source and bundle layouts
- missing container-native readiness encoding

The remaining work is now narrower and more architectural:

- complete real packaged/manual environment proof

