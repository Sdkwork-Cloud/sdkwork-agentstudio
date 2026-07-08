> Migrated from `docs/release/release-2026-04-08-29.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the OpenAI-compatible local proxy request-serving layer into a dedicated Rust submodule.
- This release candidate keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, runtime, and desktop-check evidence.

## Attempt Outcome

- The loop repaired one remaining OpenAI-compatible local proxy hotspot:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still owned OpenAI-compatible `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/embeddings` request handling, provider-specific translated adapter dispatch, model-id resolution, and token-usage extraction even though they formed a coherent request-serving boundary
  - `scripts/check-desktop-platform-foundation.mjs` had been tightened to require the split, but it was still checking many shared OpenAI-compatible dependency usages in the parent runtime file instead of the new module owner
- Implemented the narrow repairs:
  - kept `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs` as the dedicated owner for the OpenAI-compatible models and translated passthrough request-serving surface
  - delegated router registration from `local_ai_proxy.rs` through `openai_compatible::models_handler`, `chat_completions_handler`, `openai_responses_handler`, and `openai_embeddings_handler`
  - removed the obsolete in-file OpenAI-compatible handler/helper stack from `local_ai_proxy.rs`
  - repointed `request_translation.rs`, `response_translation.rs`, and `streaming.rs` to consume the remaining resolver/token-usage helper ownership from `openai_compatible.rs`
  - tightened the desktop foundation gate so the relocated shared-helper usage is now required inside `openai_compatible.rs`
- Fresh verification:
  - RED: `node scripts/check-desktop-platform-foundation.mjs`
  - GREEN: `node scripts/check-desktop-platform-foundation.mjs`
  - `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-openai-compatible local_ai_proxy_`
  - `pnpm.cmd check:desktop-openclaw-runtime`
  - `pnpm.cmd check:desktop`

## Change Scope

- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
- `scripts/check-desktop-platform-foundation.mjs`
- `docs/review/step-03-local-ai-proxy-openai-compatible-hotspot-split-2026-04-08.md`
- `docs/架构/114-2026-04-08-local-ai-proxy-openai-compatible-module-boundary.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-29.md`
- `docs/release/releases.json`

## Verification Focus

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-openai-compatible local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if OpenAI-compatible request-serving or helper ownership is copied back into `local_ai_proxy.rs`.
- Shared runtime owners for request translation, response translation, streaming, observability, and upstream request building must remain shared; later refactors should not fork OpenAI-compatible-only copies outside the dedicated module boundary.
- Rollback is limited to the listed Rust/script files and the associated review, architecture, and release writebacks.

