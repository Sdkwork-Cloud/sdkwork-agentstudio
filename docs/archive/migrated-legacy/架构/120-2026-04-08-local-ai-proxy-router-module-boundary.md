# 120-2026-04-08 Local AI Proxy Router Module Boundary

## Decision

The desktop local AI proxy must keep the HTTP route surface under a dedicated router owner:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns:
  - runtime lifecycle and state transitions
  - observability repository caching
  - proxy start / stop / status / probe entrypoints
  - the remaining parent-only helpers:
    - `is_loopback_host(...)`
    - `append_proxy_log(...)`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs`
  owns:
  - `build_router(...)`
  - all path-to-handler assembly for:
    - `/health`
    - `/v1/health`
    - `/v1/models`
    - `/v1/chat/completions`
    - `/v1/responses`
    - `/v1/embeddings`
    - `/v1/messages`
    - `/v1beta/models`
    - `/v1beta/models/{model_action}`
    - `/v1/models/{model_action}`

Shared proxy result typing must continue to come from `types.rs`, not the parent runtime namespace:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`

Both modules must import `types::ProxyHttpResult` directly.

`scripts/check-desktop-platform-foundation.mjs` must assert:

- the `router.rs` module file
- the `mod router;` declaration
- runtime-side `router::build_router(state)` usage
- route-handler delegation strings in `router.rs`
- removal of the old in-file route assembly from `local_ai_proxy.rs`
- direct `types::ProxyHttpResult` usage in `request_translation.rs` and `upstream.rs`

## Why

- Step 03 remained serial on desktop runtime-boundary work, and after the earlier protocol / health / support / observability / shared-types splits, `local_ai_proxy.rs` still carried one remaining non-runtime owner: the route surface itself.
- Path-to-handler assembly is a coherent boundary independent from lifecycle, runtime locking, route-probe persistence, and repository caching.
- GREEN verification exposed that two callers still depended on `ProxyHttpResult` through the parent module scope, which proved the shared-types owner was still partially bypassed.
- Keeping both boundaries explicit prevents the runtime file from silently re-accumulating:
  - HTTP surface ownership
  - hidden shared-type re-export behavior
- Built-in OpenClaw authority surfaces still depend on the managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so this route owner still belongs in the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains plugin registration only, so it is not an acceptable home for route assembly or runtime proxy contracts.

## Standard

- New local AI proxy HTTP routes must be added in `local_ai_proxy/router.rs`, not directly in `local_ai_proxy.rs`.
- `local_ai_proxy.rs` may wire the runtime into Axum through `router::build_router(state)`, but it must not recreate inline `.route(...)` chains once the router owner exists.
- Consumers that need shared proxy HTTP result typing must import `ProxyHttpResult` from `local_ai_proxy/types.rs`, never through parent lexical scope.
- `router.rs` must stay focused on path-to-handler assembly and state binding; it must not absorb request parsing, response shaping, runtime lifecycle, or observability writeback behavior.

## Impact

- `CP03-2` now leaves the parent local proxy file close to a true runtime owner rather than a mixed runtime-and-route surface.
- Route-surface drift and shared-type drift are both auditable through the desktop structure gate instead of being rediscovered by compile failures.
- Future Step 03 work can move from hotspot splitting toward `CP03-3` startup / upgrade / rollback / smoke evidence with less risk that the local proxy runtime file will re-accumulate mixed ownership.
