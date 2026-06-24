> Migrated from `docs/review/step-03-local-ai-proxy-shared-support-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local AI proxy shared error/time/text helper layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, local-proxy Rust-test, and desktop runtime evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime lifecycle and router assembly with one remaining shared support hotspot:
    - `proxy_error(...)`
    - `duration_to_ms(...)`
    - `trim_optional_text(...)`
    - `current_time_ms(...)`
  - That helper cluster was already consumed across `request_context.rs`, `response_io.rs`, `observability.rs`, `streaming.rs`, `probe.rs`, `upstream.rs`, `openai_compatible.rs`, `request_translation.rs`, `anthropic_native.rs`, `gemini_native.rs`, and `health.rs`, proving it was a coherent cross-module owner rather than parent-runtime glue.
  - After the earlier request-context split, `scripts/check-desktop-platform-foundation.mjs` still did not freeze this shared support boundary, so the parent runtime file remained a hidden second owner.
- Implemented the narrow repair:
  - added `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/support.rs` as the dedicated owner for:
    - shared proxy error shaping
    - shared duration-to-milliseconds conversion
    - shared trimmed preview/body normalization
    - shared current-time timestamp calculation
  - changed `local_ai_proxy.rs` to keep lifecycle, router assembly, `lock_observability(...)`, `is_loopback_host(...)`, and `append_proxy_log(...)` while declaring `mod support;`
  - repointed:
    - `request_context.rs` to consume `support::proxy_error`
    - `response_io.rs` to consume `support::{proxy_error, trim_optional_text}`
    - `observability.rs` to consume `support::{current_time_ms, duration_to_ms, trim_optional_text}`
    - `streaming.rs` to consume `support::{duration_to_ms, proxy_error, trim_optional_text}`
    - `probe.rs` to consume `support::current_time_ms`
    - `upstream.rs`, `openai_compatible.rs`, `request_translation.rs`, `anthropic_native.rs`, `gemini_native.rs`, and `health.rs` to consume `support::proxy_error`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the `support.rs` module file
    - the `mod support;` declaration
    - explicit `support::...` ownership usages in `request_context.rs`, `response_io.rs`, `observability.rs`, `streaming.rs`, `probe.rs`, and `openai_compatible.rs`
    - removal of the old in-file support helper stack from `local_ai_proxy.rs`
- Actual workspace result:
  - the local proxy runtime now keeps lifecycle and router assembly in `local_ai_proxy.rs` while the shared generic support layer lives under a dedicated owner consumed by protocol, translation, streaming, observability, health, and probe modules
  - `lock_observability(...)`, `is_loopback_host(...)`, and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; this loop did not broaden the slice beyond the coherent shared-support owner
  - fresh verification kept the new support boundary green across the desktop structure gate and focused local proxy Rust tests

## OpenClaw Fact Sources

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the shared support layer still belongs to the managed built-in OpenClaw runtime chain rather than an unrelated browser-only helper surface
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy routing and auth configuration
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this shared support boundary moves
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the shared support layer still belongs to a writable managed runtime envelope
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy surface that now consumes the new support owner
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so the shared support boundary remains inside the OpenClaw-specific runtime chain
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod support;` at line `64`, keeps message-capture updates on `support::current_time_ms()` at line `464`, and intentionally retains only `lock_observability(...)` at line `553`, `is_loopback_host(...)` at line `591`, and `append_proxy_log(...)` at line `599` from the older generic helper stack
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/support.rs`
  - the new module now owns `duration_to_ms(...)` at line `5`, `trim_optional_text(...)` at line `14`, `current_time_ms(...)` at line `27`, and `proxy_error(...)` at line `35`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - the request-context owner now consumes `support::proxy_error` at line `2`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - the shared response/error owner now consumes `support::{proxy_error, trim_optional_text}` at line `3`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - the shared observability owner now consumes `support::{current_time_ms, duration_to_ms, trim_optional_text}` at line `3`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - the shared streaming owner now consumes `support::{duration_to_ms, proxy_error, trim_optional_text}` at line `7`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - the route-probe owner now consumes `support::current_time_ms` at line `3`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - the OpenAI-compatible owner now consumes `support::proxy_error` at line `8`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - the Anthropic native owner now consumes `support::proxy_error` at line `5`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - the Gemini native owner now consumes `support::proxy_error` at line `5`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
  - the request-translation owner now consumes `support::proxy_error` at line `2`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`
  - the upstream request-builder owner now consumes `support::proxy_error` at line `1`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - the health/status owner now consumes `support::proxy_error` at line `2`
- `scripts/check-desktop-platform-foundation.mjs`
  - the Step 03 desktop structure gate now requires the support module file at line `122`, the `mod support;` declaration at line `264`, representative support-owner usages at lines `408-439`, and removal of the obsolete in-file helper definitions from `local_ai_proxy.rs` at lines `529-544`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-8`, so shared proxy support helpers must remain in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo fmt --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-support local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the protocol-specific owners, shared response/error owner, shared request-context owner, and shared support owner are extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if shared support helpers are copied back into `local_ai_proxy.rs` or duplicated independently across protocol-specific and shared modules.
- `lock_observability(...)`, `is_loopback_host(...)`, and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; later refactors should move them only if they can be closed as a separate coherent owner without re-entangling the new boundary.
- Rollback is limited to:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/support.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

