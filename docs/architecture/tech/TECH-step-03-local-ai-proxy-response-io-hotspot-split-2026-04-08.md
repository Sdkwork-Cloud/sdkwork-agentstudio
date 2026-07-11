> Migrated from `docs/review/step-03-local-ai-proxy-response-io-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local AI proxy shared buffered-response, JSON-outcome, and error-shaping layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, runtime, and desktop-check evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime lifecycle, router assembly, auth, snapshot access, and request parsing with one remaining shared response/error hotspot:
    - `ProxyRouteOutcome`
    - `build_json_outcome(...)`
    - `build_buffered_upstream_response(...)`
    - `resolve_error_message(...)`
    - `extract_proxy_error_message(...)`
    - `parse_json_response(...)`
    - `build_json_response(...)`
  - That helper cluster was already consumed across `openai_compatible.rs`, `anthropic_native.rs`, `gemini_native.rs`, `probe.rs`, and `observability.rs`, proving it was a coherent cross-protocol owner rather than parent-runtime glue.
  - After the earlier OpenAI-compatible split, `scripts/check-desktop-platform-foundation.mjs` still did not freeze this shared response/error boundary, so the parent runtime file remained a hidden second owner.
- Implemented the narrow repair:
  - added `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs` as the dedicated owner for:
    - `ProxyRouteOutcome`
    - buffered upstream response shaping
    - JSON outcome construction
    - upstream JSON response parsing
    - shared proxy error-message resolution
    - JSON response building
  - changed `local_ai_proxy.rs` to keep lifecycle, router assembly, auth/header normalization, request-body parsing, and generic timing/text helpers while declaring `mod response_io;`
  - repointed:
    - `openai_compatible.rs` to consume `build_buffered_upstream_response(...)`, `build_json_outcome(...)`, `parse_json_response(...)`, and `ProxyRouteOutcome`
    - `anthropic_native.rs` and `gemini_native.rs` to consume `build_buffered_upstream_response(...)` and `ProxyRouteOutcome`
    - `probe.rs` to consume `extract_proxy_error_message(...)` and `resolve_error_message(...)`
    - `observability.rs` to consume `extract_proxy_error_message(...)` and `ProxyRouteOutcome`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the `response_io.rs` module file
    - the `mod response_io;` declaration
    - explicit `response_io` ownership imports in `openai_compatible.rs`, `probe.rs`, and `observability.rs`
    - response preview extraction ownership to live in `response_io.rs`
    - removal of the old in-file response/error helper stack from `local_ai_proxy.rs`
- Actual workspace result:
  - the local proxy runtime now keeps lifecycle and routing in `local_ai_proxy.rs` while the shared response/error layer lives under a dedicated owner that is consumed by protocol and observability modules
  - the first focused Rust verification exposed one real residual compile bug: `parse_json_body(...)` still lives in the parent runtime file, so removing the parent `Bytes` import broke compilation; reintroducing that minimal import restored the intended boundary without broadening the new module
  - the first broad `pnpm.cmd check:desktop` pass exposed one real gate-hardening gap after `cargo fmt`: the structure script was still matching a formatting-sensitive single-line import shape for `openai_compatible.rs`; after tightening the script to assert stable `response_io` import ownership and helper-name evidence instead of a single literal line, the desktop check returned to green

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the local proxy response/error layer still belongs to the managed built-in OpenClaw runtime chain rather than an unrelated browser-only helper surface
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy configuration and provider routing
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this shared response/error boundary moves
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the response/error layer still belongs to a writable managed runtime envelope
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy surface that now consumes the new response/error owner
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so the response/error boundary remains inside the OpenClaw-specific runtime chain
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod response_io;` at line `61`, keeping the shared response/error owner under the runtime service layer instead of re-accumulating it in the parent file
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - the new module now owns `ProxyRouteOutcome` at line `13`, `build_json_outcome(...)` at line `22`, `build_buffered_upstream_response(...)` at line `39`, `resolve_error_message(...)` at line `86`, `extract_proxy_error_message(...)` at line `112`, and `parse_json_response(...)` at line `116`
  - response preview extraction is now consumed from `observability::extract_response_preview_from_value(...)` inside the dedicated owner at lines `27` and `63`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - the OpenAI-compatible request-serving owner now imports the shared response/error boundary through `response_io::{...}` at lines `4-7` and consumes the extracted helpers at lines `184`, `228`, `274-275`, `309`, `354-355`, `384`, `387-388`, `443`, `489-490`, `526`, `571-572`, `644`, `690-691`, `737`, `782-783`, and `817`, `820-821`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - the Anthropic native owner now consumes `response_io::{build_buffered_upstream_response, ProxyRouteOutcome}` at line `4` and the buffered-response helper at line `89`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - the Gemini native owner now consumes `response_io::{build_buffered_upstream_response, ProxyRouteOutcome}` at line `3` and the buffered-response helper at line `171`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - the route probe owner now consumes `response_io::{extract_proxy_error_message, resolve_error_message}` at line `3` and uses those helpers at lines `94` and `195`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - the observability owner now consumes `response_io::{extract_proxy_error_message, ProxyRouteOutcome}` at line `3` and uses the extracted helpers at lines `100`, `188`, and `193`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-8`, so shared response/error handling must remain in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- RED: `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-response-io local_ai_proxy_`
- GREEN: `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-response-io local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- RED: `pnpm.cmd check:desktop`
- GREEN: `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the protocol-specific owners and the shared response/error owner are extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if shared response/error helpers are copied back into `local_ai_proxy.rs` or duplicated independently across protocol owners.
- `proxy_error(...)`, `parse_json_body(...)`, auth/header normalization, snapshot access, and timing/text helpers intentionally remain in the parent runtime file for now; later refactors should move them only if they can be closed as a separate coherent owner without re-entangling the new boundary.
- Rollback is limited to:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

