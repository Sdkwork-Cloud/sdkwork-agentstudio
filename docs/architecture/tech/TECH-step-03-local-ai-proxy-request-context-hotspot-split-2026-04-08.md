> Migrated from `docs/review/step-03-local-ai-proxy-request-context-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local AI proxy shared request-entry, route-guard, auth, header, and JSON-body parsing layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, OpenClaw runtime, and desktop-check evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime lifecycle and router assembly with one remaining shared request-entry hotspot:
    - `current_snapshot(...)`
    - `require_route_for_protocol(...)`
    - `require_client_auth(...)`
    - `header_text(...)`
    - `parse_json_body(...)`
  - That helper cluster was already consumed across `openai_compatible.rs`, `anthropic_native.rs`, `gemini_native.rs`, and `health.rs`, proving it was a coherent cross-protocol owner rather than parent-runtime glue.
  - After the earlier response-io split, `scripts/check-desktop-platform-foundation.mjs` still did not freeze this request-context boundary, so the parent runtime file remained a hidden second owner.
- Implemented the narrow repair:
  - added `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs` as the dedicated owner for:
    - snapshot reads
    - client-protocol route lookup
    - client auth validation
    - header text extraction
    - JSON request-body parsing
  - changed `local_ai_proxy.rs` to keep lifecycle, router assembly, extracted response/streaming/upstream/projection owners, and generic proxy/timing/text/logging helpers while declaring `mod request_context;`
  - repointed:
    - `openai_compatible.rs` to consume `current_snapshot(...)`, `require_client_auth(...)`, `require_route_for_protocol(...)`, and `parse_json_body(...)`
    - `anthropic_native.rs` to consume `current_snapshot(...)`, `require_client_auth(...)`, `require_route_for_protocol(...)`, `parse_json_body(...)`, and `header_text(...)`
    - `gemini_native.rs` to consume `current_snapshot(...)`, `require_client_auth(...)`, and `require_route_for_protocol(...)`
    - `health.rs` to consume `current_snapshot(...)`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the `request_context.rs` module file
    - the `mod request_context;` declaration
    - explicit `request_context::...` ownership usages in the consuming modules
    - removal of the old in-file request-context helper stack from `local_ai_proxy.rs`
  - hardened the gate once more so the old helper-removal check now catches the lifetime-bearing `fn require_route_for_protocol<'...` signature instead of depending on a formatting-sensitive exact literal.
- Actual workspace result:
  - the local proxy runtime now keeps runtime lifecycle and router assembly in `local_ai_proxy.rs` while the shared request-entry/request-guard layer lives under a dedicated owner consumed by protocol and health modules
  - `proxy_error(...)`, `duration_to_ms(...)`, `trim_optional_text(...)`, `current_time_ms(...)`, `lock_observability(...)`, `is_loopback_host(...)`, and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; this loop did not broaden the slice beyond the coherent request-context owner
  - fresh verification kept the new request-context boundary green across focused local proxy tests, the managed OpenClaw runtime checks, and the full desktop check

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the request-entry/auth boundary still belongs to the managed built-in OpenClaw runtime chain rather than an unrelated browser-only helper surface
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy routing and auth configuration
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this shared request-context boundary moves
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the request-context layer still belongs to a writable managed runtime envelope
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy surface that now consumes the new request-context owner
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so the request-context boundary remains inside the OpenClaw-specific runtime chain
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod request_context;` at line `59`, keeping the shared request-entry owner under the runtime service layer instead of re-accumulating it in the parent file
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - the new module now owns `current_snapshot(...)` at line `11`, `require_route_for_protocol(...)` at line `26`, `require_client_auth(...)` at line `40`, `header_text(...)` at line `67`, and `parse_json_body(...)` at line `76`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - the OpenAI-compatible request-serving owner now consumes the extracted request-context boundary through `request_context::current_snapshot(...)` at lines `26` and `117`, `request_context::require_client_auth(...)` at lines `27` and `118`, `request_context::require_route_for_protocol(...)` at lines `28` and `119`, and `request_context::parse_json_body(...)` at lines `137`, `210`, `291`, `368`, `423`, `506`, `614`, `707`, and `796`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - the Anthropic native owner now consumes `request_context::current_snapshot(...)` at line `22`, `request_context::require_client_auth(...)` at line `23`, `request_context::require_route_for_protocol(...)` at line `24`, `request_context::parse_json_body(...)` at line `25`, and `request_context::header_text(...)` at lines `44` and `47`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - the Gemini native owner now consumes `request_context::current_snapshot(...)` at lines `29` and `73`, `request_context::require_client_auth(...)` at lines `30` and `74`, and `request_context::require_route_for_protocol(...)` at lines `31` and `75`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - the health/status owner now consumes `request_context::current_snapshot(...)` at line `109`
- `scripts/check-desktop-platform-foundation.mjs`
  - the Step 03 desktop structure gate now requires the request-context module file at line `122`, the `mod request_context;` declaration at line `263`, consumer ownership evidence at lines `403-463`, and removal of the obsolete in-file helper definitions from `local_ai_proxy.rs` at lines `468-488`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-8`, so request-entry and auth-guard responsibilities must remain in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-request-context local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the protocol-specific owners, shared response/error owner, and shared request-context owner are extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if shared snapshot/auth/header/body helpers are copied back into `local_ai_proxy.rs` or duplicated independently across protocol-specific modules.
- `proxy_error(...)`, `duration_to_ms(...)`, `trim_optional_text(...)`, `current_time_ms(...)`, `lock_observability(...)`, `is_loopback_host(...)`, and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; later refactors should move them only if they can be closed as a separate coherent owner without re-entangling the new boundary.
- Rollback is limited to:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

