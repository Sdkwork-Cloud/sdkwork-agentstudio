> Migrated from `docs/review/step-09-performance-baseline-and-capacity-redlines-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 09 Performance Baseline And Capacity Redlines - 2026-04-10

## Scope

- Step: `09`
- Wave: `C`
- Checkpoint focus:
  - `CP09-1`
  - `CP09-4`
- Current loop goal:
  - freeze the current performance and capacity baseline with fresh evidence instead of relying on stale review notes
  - close the remaining Step 09 gap after the observability and packaged-smoke slices landed

## Baseline Decision

Step 09 does **not** introduce the final long-term quality gate. That belongs to Step 10 and Step 11.

Step 09 does need one frozen baseline that future gates can promote. In this loop, the baseline is:

- frontend heavy-panel route cost stays materially below the old eager-loaded `InstanceDetail` baseline
- local proxy runtime keeps route-level request metrics and route probe evidence
- local proxy streaming keeps first-chunk latency below the current synthetic threshold
- packaged desktop launch evidence preserves the same proxy runtime artifact facts that support surfaces already read back

## Frozen Performance And Capacity Red Lines

### 1. Heavy-panel route split must stay in place

- The route-level `InstanceDetail` chunk remains separated from the heaviest `config` and `files` panels.
- Fresh production build output in this loop shows:
  - `dist/assets/InstanceDetail-kRoG95zN.js`: `179.73 kB`
  - `dist/assets/InstanceConfigWorkbenchPanel-BhQOHkul.js`: `63.33 kB`
  - `dist/assets/InstanceDetailFilesSection-Blul__nB.js`: `2.38 kB`
- This remains materially lower than the earlier eager-loaded baseline of about `262.56 kB` recorded in the Step 07 performance review trail.

### 2. Local proxy route metrics must stay runtime-backed

- `local_ai_proxy.rs` route-metric tests already freeze that a successful request produces runtime-backed metrics including:
  - `request_count`
  - `success_count`
  - `failure_count`
  - `rpm`
  - `average_latency_ms`
  - `last_latency_ms`
- That keeps the capacity/readiness baseline tied to the runtime truth source rather than UI inference.

### 3. Local proxy route tests must stay runtime-backed

- `local_ai_proxy.rs` route-probe tests already freeze that a successful route test records:
  - a checked capability
  - a model identity when available
  - a measured latency
  - a success/failure record that later surfaces through `routeTests`

### 4. Local proxy streaming first chunk must stay under the current synthetic threshold

- The passthrough streaming baseline stays locked to:
  - `first_chunk_latency < 650ms`
- That threshold already exists in Rust test coverage for the synthetic upstream used by the managed local proxy.
- Step 09 therefore freezes the current streaming-performance floor instead of leaving it as incidental test behavior.

### 5. Packaged launch must preserve the same support/runtime evidence

- `desktop-startup-smoke-report.json` now preserves `localAiProxyRuntime`.
- Aggregated release metadata now preserves `desktopStartupSmoke.localAiProxyRuntime`.
- Upgrade-smoke evidence now also lifts that same summary through `packagedLaunchSmokeSummary`.
- This closes the earlier gap where runtime facts existed in the running app but disappeared from packaged smoke and release evidence.

## Fresh Verification

- Frontend baseline:
  - `pnpm.cmd build`
- Runtime baseline:
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_ai_proxy_chat_completions_streaming_passthrough_preserves_first_chunk_latency -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_ai_proxy_status_records_route_metrics_after_successful_request -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_ai_proxy_test_route_by_id_records_latest_successful_probe -- --nocapture`
- Packaged-smoke / release-evidence baseline:
  - `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
  - `node scripts/release/smoke-desktop-startup-evidence.test.mjs`
  - `node scripts/release/finalize-release-assets.test.mjs`
  - `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - `node scripts/release-flow-contract.test.mjs`
  - `node scripts/check-release-closure.mjs`

## Cross-Reference Evidence

- `docs/review/step-07-section-router-heavy-panel-lazy-loading-2026-04-09.md`
- `docs/review/step-09-kernel-center-local-ai-proxy-observability-readback-2026-04-10.md`
- `docs/review/step-09-api-settings-local-proxy-runtime-evidence-readback-2026-04-10.md`
- `docs/review/step-09-packaged-desktop-local-proxy-runtime-smoke-evidence-2026-04-10.md`

## Closure Status

- `CP09-1`: green
  - the heavy-panel split remains real and measurable in fresh production output
- `CP09-2`: green
  - Kernel Center and ApiSettings now both expose runtime-backed local proxy observability and artifact evidence
- `CP09-3`: green
  - packaged desktop launch smoke, release metadata, and upgrade-smoke evidence now preserve the local proxy runtime artifact chain
- `CP09-4`: green
  - the current performance baseline and capacity red lines are now frozen with fresh build and Rust runtime evidence
- `Step 09`: closed

## Handoff To Later Steps

- Step 10 can promote these baselines into formal quality gates.
- Step 11 can keep using the same packaged startup-smoke and release-metadata contract as a release-blocking rule.

