> Migrated from `docs/release/release-2026-04-08-20.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted local proxy route probing into a dedicated Rust submodule.
- This release candidate keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate evidence.

## Attempt Outcome

- The loop repaired one remaining local proxy control-plane hotspot:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still owned route-probe orchestration, capability classification, protocol-specific probe HTTP construction, and probe response success parsing even though those concerns are distinct from request-serving, observability, and projection logic
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze that boundary
- Implemented the narrow repairs:
  - added `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - delegated `probe::probe_route(...)` from `local_ai_proxy.rs`
  - tightened the desktop foundation gate so the probe module file, declaration, and delegation are now required
- Fresh verification:
  - RED: `node scripts/check-desktop-platform-foundation.mjs`
  - GREEN: `node scripts/check-desktop-platform-foundation.mjs`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-probe local_ai_proxy_test_route_by_id_`
  - `pnpm.cmd check:desktop`
  - `pnpm.cmd check:desktop-openclaw-runtime`

## Change Scope

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
- `scripts/check-desktop-platform-foundation.mjs`
- `docs/review/step-03-local-ai-proxy-probe-hotspot-split-2026-04-08.md`
- `docs/架构/105-2026-04-08-local-ai-proxy-probe-module-boundary.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-20.md`
- `docs/release/releases.json`

## Verification Focus

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-probe local_ai_proxy_test_route_by_id_`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:desktop-openclaw-runtime`

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if probe HTTP construction is reintroduced into `local_ai_proxy.rs`.
- Route-test persistence remains in the main service; later internal refactors must preserve that boundary rather than folding probe behavior back into the runtime hotspot.
- Rollback is limited to the listed Rust/script files and the associated review, architecture, and release writebacks.

