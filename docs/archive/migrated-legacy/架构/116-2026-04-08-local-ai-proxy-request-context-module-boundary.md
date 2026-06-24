# 116-2026-04-08 Local AI Proxy Request Context Module Boundary

## Decision

The desktop local AI proxy must keep the shared request-entry and request-guard layer in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, extracted module wiring, and generic proxy/timing/text/logging helpers
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  owns:
  - `current_snapshot(...)`
  - `require_route_for_protocol(...)`
  - `require_client_auth(...)`
  - `header_text(...)`
  - `parse_json_body(...)`

The dedicated request-context module must be consumed by the current shared callers instead of being re-exported back through the parent runtime file:

- `local_ai_proxy/openai_compatible.rs`
- `local_ai_proxy/anthropic_native.rs`
- `local_ai_proxy/gemini_native.rs`
- `local_ai_proxy/health.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod request_context;` declaration, the ownership usages in the consuming modules, and removal of the old in-file helper stack from `local_ai_proxy.rs`, including the lifetime-bearing `require_route_for_protocol<'...` signature.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` still carried one large shared request-entry hotspot even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, health/status, OpenAI-compatible, and response-io splits.
- The request-context path is one coherent owner because it bundles:
  - snapshot access
  - client-protocol route lookup
  - client auth guard logic
  - header extraction
  - JSON request-body parsing
- Without a dedicated owner, the main runtime file re-accumulates cross-protocol request semantics that should stay outside lifecycle/router assembly and should not be split inconsistently across protocol-specific modules.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the shared request-context layer still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so request-entry, auth, and body-parse responsibilities cannot move into plugin wiring.

## Standard

- New snapshot-access, route-guard, client-auth, header, and request-body-parse helpers for the local AI proxy must live under `local_ai_proxy/request_context.rs`.
- `local_ai_proxy.rs` may continue to own generic runtime helpers, but it should not re-accumulate the extracted request-context helper stack once the boundary exists.
- Protocol and shared health/status owners that need this behavior must import it from `request_context.rs`, not from the parent runtime file.
- `request_context.rs` may depend on the shared `proxy_error(...)` contract and existing snapshot/auth types, but it must not duplicate unrelated response, observability, or streaming concerns.

## Impact

- Step 03 now has a dedicated owner for shared request-entry and request-guard behavior inside the local proxy runtime.
- Future changes to OpenAI-compatible, Anthropic native, Gemini native, and health/status request flows can share one audited request-context boundary instead of each carrying local copies.
- The desktop structure gate can now distinguish a real request-context boundary split from a partial helper shuffle and is hardened against formatting drift in lifetime-bearing function signatures.
