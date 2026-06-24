# 117-2026-04-08 Local AI Proxy Shared Support Module Boundary

## Decision

The desktop local AI proxy must keep the shared generic support layer in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, extracted module wiring, and the remaining parent-only helpers:
  - `lock_observability(...)`
  - `is_loopback_host(...)`
  - `append_proxy_log(...)`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/support.rs`
  owns:
  - `proxy_error(...)`
  - `duration_to_ms(...)`
  - `trim_optional_text(...)`
  - `current_time_ms(...)`

The dedicated shared-support module must be consumed by the current shared callers instead of being re-exported back through the parent runtime file:

- `local_ai_proxy/request_context.rs`
- `local_ai_proxy/response_io.rs`
- `local_ai_proxy/observability.rs`
- `local_ai_proxy/streaming.rs`
- `local_ai_proxy/probe.rs`
- `local_ai_proxy/upstream.rs`
- `local_ai_proxy/openai_compatible.rs`
- `local_ai_proxy/request_translation.rs`
- `local_ai_proxy/anthropic_native.rs`
- `local_ai_proxy/gemini_native.rs`
- `local_ai_proxy/health.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod support;` declaration, representative owner usages in the consuming modules, and removal of the old in-file support helper stack from `local_ai_proxy.rs`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` still carried one large shared generic helper hotspot even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, health/status, OpenAI-compatible, response-io, and request-context splits.
- The shared-support path is one coherent owner because it bundles:
  - proxy-facing error shaping
  - duration normalization
  - trimmed preview/body normalization
  - timestamp generation
- Without a dedicated owner, the main runtime file re-accumulates generic cross-module helper semantics that should stay outside lifecycle/router assembly and should not be split inconsistently across protocol-specific and shared modules.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the shared support layer still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so generic proxy support helpers cannot move into plugin wiring.

## Standard

- New shared proxy error, time, and text-normalization helpers for the local AI proxy must live under `local_ai_proxy/support.rs`.
- `local_ai_proxy.rs` may continue to own parent-only runtime helpers, but it should not re-accumulate the extracted support helper stack once the boundary exists.
- Protocol, translation, streaming, observability, health, and probe owners that need this behavior must import it from `support.rs`, not from the parent runtime file.
- `support.rs` may remain dependency-light and generic, but it must not absorb unrelated auth, request parsing, response shaping, observability persistence, or health projection concerns.

## Impact

- Step 03 now has a dedicated owner for shared generic support behavior inside the local proxy runtime.
- Future changes to request serving, translation, streaming, observability, probing, and health/status flows can share one audited support boundary instead of each carrying local copies or pulling those helpers back into the parent runtime file.
- The desktop structure gate can now distinguish a real shared-support boundary split from a partial helper shuffle.
