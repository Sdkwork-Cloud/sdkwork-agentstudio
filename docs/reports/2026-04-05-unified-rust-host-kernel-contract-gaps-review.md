# Unified Rust Host Kernel Contract Gaps Review

Date: 2026-04-05

Scope:
- shared Rust host kernel contracts
- host platform metadata
- capability declaration semantics
- desktop hosted runtime descriptor lifecycle
- deployment-facing contract exposure

## Summary

The shared Rust host kernel is structurally in place, but several low-level contracts still report metadata that looks authoritative while actually being synthetic, unstable, or stale. These issues sit below the earlier runtime-split findings and will continue to leak incorrect behavior into `desktop`, `server`, `docker`, and `k8s` even after route-level fixes unless they are corrected.

## Verification

Commands executed:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`

Result:

- pass
- the passing suite confirms that stale hosted runtime descriptor fallback is currently intentional behavior, not an accident

## Findings

### 1. High: host capability declarations are mode-derived, not provider-derived

Evidence:
- `packages/sdkwork-agentstudio-pc-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/internal_node_sessions.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/main.rs`

What is happening:

- `manage_capability_keys_for_mode(mode)` and `host_platform_capability_keys_for_mode(mode)` build capability sets from the host mode string alone
- desktop combined host platform status uses `host_platform_capability_keys_for_mode("desktopCombined")`
- server internal host-platform status also uses static capability keys
- tests explicitly assert that desktop combined exposes:
  - `manage.host-endpoints.read`
  - `manage.openclaw.runtime.read`
  - `manage.openclaw.gateway.read`
  - `manage.openclaw.gateway.invoke`

Why this is a bug:

- capabilities are supposed to describe what the current host can do
- the current implementation describes what a mode is expected to do in theory
- this overstates support whenever the bound provider is inactive, partially implemented, or unavailable at runtime

Concrete fallout:

- desktop combined advertises `manage.openclaw.gateway.invoke` even though hosted non-dry-run invoke is still not implemented
- host platform capability consumers cannot tell "feature exists in this build" from "feature is currently live and backed by a real provider"
- CI currently locks this overstatement in place

Required direction:

- split capability contracts into:
  - static supported capabilities
  - live available capabilities
- compute live capabilities from the actual bound provider and runtime state, not only from `mode`

### 2. High: host platform `version` is not a version

Evidence:
- `packages/sdkwork-agentstudio-pc-host-core/src-host/src/lib.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/api_public.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/openapi.rs`

What is happening:

- `host_core_metadata()` only exposes `package_name`
- server `host_platform_version()` returns `"{distribution_family}@{package_name}"`
- desktop host platform status returns `format!("desktop@{}", metadata.package_name)`
- tests only assert that the field starts with `"desktop@"`

Why this is a bug:

- a field named `version` implies a semantic version or release identifier
- the current value is a product-family plus package-name label
- diagnostics, telemetry, compatibility checks, and UI all receive a misleading value

Concrete fallout:

- API discovery `hostVersion`
- internal host-platform `version`
- OpenAPI extension metadata

all expose a pseudo-version instead of a release version

Required direction:

- add real version metadata to host-core, for example package version plus optional build revision
- rename the current family/package label if it is still useful, but do not keep it in `version`

### 3. High: `updatedAt` and `generatedAt` are request-time stamps, not state-time stamps

Evidence:
- `packages/sdkwork-agentstudio-pc-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/internal_node_sessions.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/api_public.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/manage_openclaw.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/openapi.rs`

What is happening:

- `ServerState::host_platform_updated_at()` returns `unix_timestamp_ms()`
- many routes reuse that helper for:
  - `updatedAt`
  - `generatedAt`
  - error envelope timestamps
  - OpenClaw runtime/gateway projections

Why this is a bug:

- the field name implies state change time, but the implementation returns response time
- two identical reads of unchanged state produce different `updatedAt` values
- clients cannot safely use these fields for caching, change detection, or reconciliation

Concrete fallout:

- polling UIs can infer churn where none exists
- parity and readiness probes cannot distinguish "same state observed later" from "state actually changed"
- diagnostic reports become noisy and misleading

Required direction:

- separate:
  - `observedAt` or `respondedAt`
  - stable state revision / state updated time
- only change `updatedAt` when the underlying runtime projection changes

### 4. Medium: desktop hosted runtime resolver intentionally reuses stale descriptors across null/error refreshes

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`

What is happening:

- the resolver caches `lastResolvedRuntime`
- if later `loadRuntime()` returns `null` or throws, it falls back to the cached runtime
- tests explicitly lock in this fallback behavior as correct

Why this is a bug:

- desktop host supports dynamic port fallback
- desktop host uses a browser session token that can rotate when the embedded host restarts
- a stale descriptor can therefore point at:
  - an old `browserBaseUrl`
  - an old port
  - an old browser session token

Concrete fallout:

- after host restart or recovery, the renderer can continue issuing requests to a dead or unauthorized endpoint
- this increases the probability of:
  - `resolveHostedBasePath` failures
  - `ERR_CONNECTION_REFUSED`
  - browser-session mismatches
  - misleading CORS-like fetch failures

Required direction:

- treat descriptor null/error after a previously live runtime as a state transition, not as a silent cache hit
- invalidate cached descriptors when:
  - lifecycle is no longer ready
  - the host restarts
  - the active port changes
  - the browser session token changes
- add explicit restart/rebind coverage to the resolver tests

### 5. Medium: HTML host metadata injection is still too raw for a control-plane contract

Evidence:
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/static_assets.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`

What is happening:

- the host injects dynamic metadata directly into HTML `<meta>` tags
- desktop bootstrap and tests fetch the browser session token from HTML metadata
- the metadata formatter does not apply HTML escaping to dynamic content

Why this is a bug:

- contract metadata should not depend on raw string injection into HTML
- if configuration-driven values ever contain unsafe characters, metadata injection becomes fragile
- using HTML meta tags as a control-plane bootstrap transport is weaker than a structured endpoint or command contract

Required direction:

- move sensitive bootstrap contract data to a structured runtime descriptor or explicit bootstrap endpoint
- HTML metadata should be informational only
- if dynamic HTML metadata remains, escape all dynamic values before insertion

## Architectural Consequence

These are not cosmetic issues. They create a pattern where the shared host kernel exposes fields that look strongly authoritative:

- `capabilityKeys`
- `version`
- `updatedAt`
- hosted runtime descriptor values

but several of those fields are currently synthetic labels or transient request-time values. That prevents higher layers from making stable decisions.

## Recommended Fix Order

1. Replace static mode-only capability declarations with provider-aware live capability projection.
2. Fix host version metadata to expose a real release version.
3. Split state timestamps from observation timestamps.
4. Invalidate stale desktop hosted runtime descriptors on restart/rebind/token rotation.
5. Move bootstrap/session discovery off raw HTML meta tags.

## Test Plan

Required additions:

- Rust tests that compare declared capabilities against actually bound providers
- host-platform tests that assert `version` is a semantic release value, not a package label
- stability tests asserting unchanged state does not mutate `updatedAt`
- resolver tests covering:
  - embedded host restart
  - dynamic port rebinding
  - browser session token rotation
  - null/error transition after a previous ready state
- bootstrap tests that use a structured runtime descriptor rather than scraping HTML metadata for the session token

## Bottom Line

The shared Rust host kernel is real, but parts of its contract surface still report synthetic truth. Until these metadata contracts become provider-aware, version-correct, state-stable, and restart-safe, higher-level fixes will continue to sit on top of unstable host semantics.
