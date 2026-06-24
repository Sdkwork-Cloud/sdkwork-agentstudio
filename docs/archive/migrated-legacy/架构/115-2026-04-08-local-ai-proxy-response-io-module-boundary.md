# 115-2026-04-08 Local AI Proxy Response IO Module Boundary

## Decision

The desktop local AI proxy must keep the shared buffered-response and error-shaping layer in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, auth/header normalization, snapshot access, request-body parsing, and generic timing/text helpers
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  owns:
  - `ProxyRouteOutcome`
  - `build_json_outcome(...)`
  - `build_buffered_upstream_response(...)`
  - `resolve_error_message(...)`
  - `extract_proxy_error_message(...)`
  - `parse_json_response(...)`
  - `build_json_response(...)`
  - response-preview extraction handoff needed by those response paths

The dedicated response IO module must be consumed by the current shared callers instead of being re-exported back through the parent runtime file:

- `local_ai_proxy/openai_compatible.rs`
- `local_ai_proxy/anthropic_native.rs`
- `local_ai_proxy/gemini_native.rs`
- `local_ai_proxy/probe.rs`
- `local_ai_proxy/observability.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod response_io;` declaration, the ownership imports/usages in the consuming modules, response preview extraction inside `response_io.rs`, and removal of the old in-file helper stack from `local_ai_proxy.rs`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` still carried one large shared hotspot even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, health/status, and OpenAI-compatible splits.
- The response/error path is one coherent owner because it bundles:
  - buffered upstream body materialization
  - JSON response decoding and re-encoding
  - shared route-outcome state
  - proxy error-message extraction from upstream payloads
  - response preview handoff used by observability
- Without a dedicated owner, the main runtime file re-accumulates cross-protocol response semantics that should stay outside lifecycle/router assembly and should not be split inconsistently across protocol-specific modules.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the shared response/error layer still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so buffered-response and error-shaping responsibilities cannot move into plugin wiring.

## Standard

- New buffered-response, JSON-outcome, and upstream-error-shaping helpers for the local AI proxy must live under `local_ai_proxy/response_io.rs`.
- `local_ai_proxy.rs` may continue to own auth/header normalization, request parsing, and generic runtime helpers, but it should not re-accumulate `ProxyRouteOutcome` or the extracted response/error helper stack once the boundary exists.
- Protocol owners and shared observability/probe owners that need this behavior must import it from `response_io.rs`, not from the parent runtime file.
- `response_io.rs` may depend on existing shared owners such as `observability::extract_response_preview_from_value(...)` and `openai_compatible::extract_token_usage(...)`, but it must not duplicate those concerns.

## Impact

- Step 03 now has a dedicated owner for shared response/error behavior inside the local proxy runtime.
- Future changes to translated OpenAI-compatible, Anthropic native, Gemini native, route probing, and observability writeback can share one audited response/error boundary instead of each carrying local copies.
- The desktop structure gate can now distinguish a real response/error boundary split from a partial helper shuffle or a formatting-only change that leaves `local_ai_proxy.rs` as the hidden second owner.
