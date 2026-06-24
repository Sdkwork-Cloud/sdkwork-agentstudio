# 118-2026-04-08 Local AI Proxy Observability Store Module Boundary

## Decision

The desktop local AI proxy must keep the shared observability-store state and lock layer in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, extracted module wiring, and the remaining parent-only helpers:
  - `is_loopback_host(...)`
  - `append_proxy_log(...)`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs`
  owns:
  - `LocalAiProxyObservabilityStore`
  - `LocalAiProxyRouteMetricsState`
  - `lock_observability(...)`

The dedicated observability-store module must be consumed by the current shared callers instead of being re-exported back through the parent runtime file:

- `local_ai_proxy.rs`
- `local_ai_proxy/health.rs`
- `local_ai_proxy/observability.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod observability_store;` declaration, the runtime-service lock usage, the store-type imports in `health.rs` and `observability.rs`, and removal of the old in-file store and lock definitions from `local_ai_proxy.rs`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` still carried one large shared observability-state hotspot even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, health/status, OpenAI-compatible, response-io, request-context, and shared-support splits.
- The observability-store path is one coherent owner because it bundles:
  - route metrics/test store state
  - runtime route metrics state
  - poisoned-lock handling for observability access
- Without a dedicated owner, the main runtime file re-accumulates cross-module observability state semantics that should stay outside lifecycle/router assembly and should not be split inconsistently across runtime, health, and observability modules.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the shared observability-store layer still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so observability store state and lock handling cannot move into plugin wiring.

## Standard

- New shared local-proxy observability store types and lock handling must live under `local_ai_proxy/observability_store.rs`.
- `local_ai_proxy.rs` may continue to own parent-only runtime helpers, but it should not re-accumulate `LocalAiProxyObservabilityStore`, `LocalAiProxyRouteMetricsState`, or `lock_observability(...)` once the boundary exists.
- Runtime, health/status, and shared observability owners that need this behavior must import it from `observability_store.rs`, not from the parent runtime file.
- `observability_store.rs` may remain dependency-light and generic, but it must not absorb unrelated auth, request parsing, response shaping, or proxy-serve-loop concerns.

## Impact

- Step 03 now has a dedicated owner for shared observability store behavior inside the local proxy runtime.
- Future changes to runtime state management, route metrics projection, and observability writeback can share one audited observability-store boundary instead of each carrying local copies or pulling those types back into the parent runtime file.
- The desktop structure gate can now distinguish a real observability-store boundary split from a partial helper shuffle.
