> Migrated from `docs/review/2026-04-06-local-ai-proxy-token-accounting-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Local AI Proxy Token Accounting Hardening

## Scope

This iteration closed a narrow but user-visible observability gap in the desktop local AI proxy:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`

The work focused on OpenAI `responses`-shaped token usage, translated `responses` payloads, and request-log visibility for prompt/completion/total/cache token counts.

## Problem

The local AI proxy already persisted token fields in the observability database and the frontend already rendered them, but two gaps remained in the runtime path:

1. OpenAI `responses` cache tokens under `usage.input_tokens_details.cached_tokens` were not extracted
2. Anthropic and Gemini translations into OpenAI `responses` dropped the `usage` object from the client-facing response body
3. Translated streaming `response.completed` events also dropped the final `usage` payload

This meant the UI and upstream response body could disagree about token visibility, and cache-token accounting for OpenAI `responses` traffic could silently fall to zero.

## Root Cause

The failure was not in the settings UI or the kernel bridge. The existing storage and presentation layers were already capable of carrying:

- `promptTokens`
- `completionTokens`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `cacheTokens`

The missing behavior came from the Rust proxy runtime:

1. `extract_token_usage(...)` only recognized cache tokens from:
   - `/usage/cache_tokens`
   - `/usage/prompt_tokens_details/cached_tokens`
   - Anthropic cache fields
   - Gemini `usageMetadata.cachedContentTokenCount`
2. It did not recognize the OpenAI `responses` path:
   - `/usage/input_tokens_details/cached_tokens`
3. `build_openai_response_from_anthropic(...)`
   and `build_openai_response_from_gemini(...)`
   translated content but did not project token usage back into the OpenAI `response` object
4. `build_openai_response_completed_event(...)` emitted the final translated SSE event without the accumulated usage snapshot

## Implementation

### 1. Completed OpenAI `responses` cache-token extraction

Extended `extract_token_usage(...)` to read:

- `/usage/input_tokens_details/cached_tokens`

This makes OpenAI `responses` cache hits flow into request logs and route metrics instead of collapsing to zero.

### 2. Centralized OpenAI `responses` usage projection

Added a small helper that converts internal `LocalAiProxyTokenUsage` into an OpenAI `responses`-shaped `usage` object:

- `input_tokens`
- `output_tokens`
- `total_tokens`
- `input_tokens_details.cached_tokens` when present

### 3. Restored usage on translated non-streaming `responses`

Updated:

- `build_openai_response_from_anthropic(...)`
- `build_openai_response_from_gemini(...)`

so translated OpenAI `responses` bodies now keep token usage instead of returning content-only payloads.

### 4. Restored usage on translated streaming completion events

Updated `build_openai_response_completed_event(...)` and the streaming completion path so the final `response.completed` event carries the accumulated usage snapshot.

## Tests Added

Added or strengthened regression coverage for:

- OpenAI `responses` cache-token extraction from `input_tokens_details.cached_tokens`
- request-log persistence for OpenAI `responses` usage and cache tokens
- translated Anthropic `responses` preserving usage in non-streaming responses
- translated Gemini `responses` preserving usage in non-streaming responses
- translated Anthropic and Gemini streaming `response.completed` events preserving usage

## Verification

Verified in this iteration:

- `cargo test extract_token_usage_reads_openai_responses_cached_input_tokens --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test local_ai_proxy_request_logs_capture_openai_responses_input_output_and_cache_usage --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test local_ai_proxy_openai_responses_translate_to_ --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test local_ai_proxy_ --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `rustfmt --edition 2021 --check packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`

All passed on 2026-04-06.

## Result

The local AI proxy now behaves consistently across direct OpenAI `responses` traffic and translated Anthropic/Gemini `responses` traffic:

- request logs retain prompt/completion/input/output/total/cache token visibility
- OpenAI `responses` cache hits are counted correctly
- translated client-facing response payloads no longer hide usage
- streaming `response.completed` events now expose final token accounting

## Remaining Risk

This iteration closes the Rust proxy runtime gap, but two adjacent review items still remain open:

- broader end-to-end validation through the desktop chat bootstrap path and built-in OpenClaw gateway flows
- cross-host verification that server/docker/k8s deployments consume the same token-accounting contract where applicable

## Next Iteration

Recommended next step:

1. trace the desktop chat and built-in OpenClaw gateway path from renderer request to local AI proxy request log
2. verify the same usage fields remain visible through the higher-level API/logging surfaces
3. continue with the broader hosted runtime and packaged smoke backlog already tracked in the system review plan

