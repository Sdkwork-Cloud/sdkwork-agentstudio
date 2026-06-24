# 119-2026-04-08 Local AI Proxy Shared Types Module Boundary

## Decision

The desktop local AI proxy must keep the shared local-proxy contract layer in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, extracted module wiring, and the remaining parent-only helpers:
  - `is_loopback_host(...)`
  - `append_proxy_log(...)`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs`
  owns:
  - `ProxyHttpResult<T>`
  - `LocalAiProxyLifecycle`
  - `LocalAiProxyDefaultRouteHealth`
  - `LocalAiProxyServiceHealth`
  - `LocalAiProxyServiceStatus`
  - `LocalAiProxyRouteRuntimeMetrics`
  - `LocalAiProxyRouteTestRecord`
  - `LocalAiProxyTokenUsage`
  - `LocalAiProxyAppState`

The dedicated shared-types module must be consumed by the current shared callers instead of being redefined back through the parent runtime file:

- `local_ai_proxy.rs`
- `local_ai_proxy/request_context.rs`
- `local_ai_proxy/response_io.rs`
- `local_ai_proxy/observability.rs`
- `local_ai_proxy/openai_compatible.rs`
- `local_ai_proxy/anthropic_native.rs`
- `local_ai_proxy/gemini_native.rs`
- `local_ai_proxy/streaming.rs`
- `local_ai_proxy/probe.rs`
- `local_ai_proxy/health.rs`
- `local_ai_proxy/projection.rs`
- `local_ai_proxy/observability_store.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod types;` declaration, representative `types::...` ownership imports in the consumer modules, and removal of the old in-file type alias and struct definitions from `local_ai_proxy.rs`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` still carried one large shared contract hotspot even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, health/status, OpenAI-compatible, response-io, request-context, support, and observability-store splits.
- The shared contract path is one coherent owner because it bundles:
  - proxy HTTP result typing
  - public lifecycle / health / status / metrics / route-test contracts
  - internal token-usage and app-state contracts used across multiple runtime submodules
- Without a dedicated owner, the main runtime file re-accumulates cross-module type semantics that should stay outside lifecycle/router assembly and should not be split inconsistently across protocol, health, projection, and observability modules.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the shared local proxy contract layer still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so shared proxy runtime contracts cannot move into plugin wiring.

## Standard

- New shared local-proxy public and internal contracts must live under `local_ai_proxy/types.rs`.
- `local_ai_proxy.rs` may continue to own parent-only runtime helpers and service wiring, but it should not re-accumulate `ProxyHttpResult<T>`, the public service/status contracts, the internal token-usage contract, or the internal app-state contract once the boundary exists.
- Runtime, request-context, response-io, observability, protocol-serving, streaming, health/status, projection, probe, and observability-store owners that need these contracts must import them from `types.rs`, not redefine them in place.
- `types.rs` may remain dependency-light, but it must not absorb auth, request parsing, response shaping, or proxy-serve-loop behavior.

## Impact

- Step 03 now has a dedicated owner for shared local-proxy contract behavior inside the local proxy runtime.
- Future changes to runtime state management, route metrics projection, protocol serving, and observability writeback can share one audited type boundary instead of each carrying local copies or pulling those contracts back into the parent runtime file.
- The desktop structure gate can now distinguish a real shared-types boundary split from a partial helper shuffle.
