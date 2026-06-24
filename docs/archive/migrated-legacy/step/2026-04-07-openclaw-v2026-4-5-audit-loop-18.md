# OpenClaw v2026.4.5 Audit Loop 18

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Scope

- Re-check the latest official OpenClaw baseline and provider docs.
- Verify whether the previously recorded `Ollama` blocker is still real after the native proxy work.
- Review the next remaining provider-center parity gap and close it only if it fits the current
  shared `web/desktop/server/docker/k8s` architecture truthfully.
- Record fresh verification evidence after the landing.

## Step 1: Upstream baseline re-validation

Review date:

- 2026-04-07

Primary upstream sources re-opened:

- GitHub release: `https://github.com/openclaw/openclaw/releases/tag/v2026.4.5`
- Ollama provider guide: `https://docs.openclaw.ai/providers/ollama`
- Cloudflare AI Gateway provider guide:
  `https://docs.openclaw.ai/providers/cloudflare-ai-gateway`

Facts re-confirmed from upstream:

1. Latest audited release remains `v2026.4.5`, published on `2026-04-06`.
2. `Ollama` is a native provider, not just another OpenAI-compatible preset. The official provider
   guide still uses `api: "ollama"` and the local base URL family rooted at `http://localhost:11434`.
3. `Cloudflare AI Gateway` is documented as an Anthropic-compatible provider with the official
   gateway URL shape:
   `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
4. `Cloudflare AI Gateway` can require optional request metadata such as
   `cf-aig-authorization`, which means Provider Center support is only honest if the shared route
   model and editor can already carry request overrides.

## Step 2: Local source re-review findings

### 2.1 Ollama blocker is no longer real in current source

The earlier audit log still listed `Ollama` as a remaining blocker, but a fresh local source review
showed that the blocker had already been closed by the later parity work:

- Shared TypeScript route schema now includes `upstreamProtocol: "ollama"`.
- Shared provider metadata now includes the `ollama` provider and curated Provider Center preset.
- Direct native OpenClaw provider saves now emit `api: "ollama"` instead of collapsing the provider
  into an OpenAI-compatible adapter.
- Desktop local proxy now translates OpenAI-compatible client requests into native Ollama upstream
  routes for:
  - chat completions
  - responses
  - embeddings
  - streaming response translation

Conclusion:

- `Ollama` must be removed from the current blocker list for source-level parity.

### 2.2 Cloudflare AI Gateway remained a real shared-metadata gap

The module-by-module re-review found a narrower but still real parity gap:

- Shared request-override persistence already existed in:
  - `sdkwork-claw-core`
  - `sdkwork-claw-settings`
  - Provider Center editor UI
- Manual Anthropic-family protocol inference for `cloudflare-ai-gateway` already existed.
- But Provider Center still did not surface `Cloudflare AI Gateway` as an official known provider:
  - no shared provider-channel catalog entry
  - no curated preset
  - no regression asserting that the known-provider surface stays aligned

Why this gap was now safe to close:

- No host-specific behavior was needed.
- No new runtime protocol union was needed.
- No new transport adapter was needed.
- The existing request-override model already supports the optional Cloudflare gateway header path.

## Step 3: Chosen landing strategy

Recommended strategy:

- Close only the missing shared metadata and preset surface.

Rejected alternatives:

1. Add host-specific Cloudflare logic in desktop only.
   - Rejected because it would fragment the provider architecture.
2. Add another template-only provider without curated metadata.
   - Rejected because it would leave the official provider directory only partially represented.
3. Defer the gap until the bundled OpenClaw runtime is upgraded.
   - Rejected because this gap lives entirely in shared source metadata and can be verified today.

## Step 4: TDD execution

Red phase:

- Added failing assertions to:
  - `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
  - `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  - `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- Canonical repo runners failed for the expected reason:
  - `node scripts/run-sdkwork-core-check.mjs`
  - `node scripts/run-sdkwork-settings-check.mjs`
- Failure confirmed the real missing behavior:
  - `cloudflare-ai-gateway` was absent from the provider channel catalog and curated preset surface.

Green phase:

- Added one shared provider-channel definition in:
  - `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- Added one curated Provider Center preset in:
  - `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- Re-ran the same repo runners and confirmed the new assertions pass.

## Step 5: Files changed in this loop

- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`

Behavior after the landing:

1. Provider Center now exposes `Cloudflare AI Gateway` as a first-class known provider.
2. The suggested route shape stays truthful:
   - `providerId: cloudflare-ai-gateway`
   - `clientProtocol: anthropic`
   - `upstreamProtocol: anthropic`
   - `baseUrl: https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
3. Request overrides remain authored through the existing shared editor surface when the gateway
   requires optional `cf-aig-authorization` headers.

## Step 6: Fresh verification evidence

Focused parity verification:

- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `node scripts/run-sdkwork-settings-check.mjs`
  - passed

Fresh workspace and host verification:

- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml ollama`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

Important verification feedback:

1. `lint` re-ran architecture boundaries, parity suites, release-flow contracts, CI-flow contracts,
   and deployment packaging contracts. That means docker/k8s source-level contract coverage stayed
   green in the same loop.
2. `check:desktop` re-validated desktop-hosted runtime contracts, packaged startup evidence
   contracts, OpenClaw release asset verification, and Tauri desktop shell boundaries.
3. The targeted Rust `ollama` test sweep passed again after the Cloudflare metadata landing, which
   confirms the new Provider Center metadata work did not regress the native Ollama transport path.

## Step 7: Current architecture status after this loop

### Verified as aligned at source-contract scope

- Shared provider architecture remains unified across:
  - browser/web host
  - desktop host
  - server host
  - container packaging
  - kubernetes packaging
- `Ollama` is now truthfully supported in both shared provider modeling and desktop native runtime
  translation.
- `Cloudflare AI Gateway` is now truthfully surfaced in Provider Center without inventing any host
  forks or fake protocol adapters.

### Remaining real blockers

1. Bundled OpenClaw runtime assets are still `2026.4.2`, so full runtime parity with
   `v2026.4.5` still requires an actual bundled runtime asset upgrade rather than more UI-side
   patching.
2. Real live smoke outside source-contract scope is still pending for:
   - packaged desktop launch on actual target platforms
   - Docker/Compose runtime boot
   - Kubernetes cluster deployment

### No longer valid as blockers

1. `Ollama` is no longer a blocker for source-level parity.
2. `Cloudflare AI Gateway` is no longer missing from Provider Center's shared known-provider
   surface.

## Step 8: Recommended next loop

Highest-value remaining work:

1. Upgrade the bundled OpenClaw runtime assets from `2026.4.2` to the audited `v2026.4.5`
   baseline.
2. After the bundled runtime upgrade, re-run:
   - desktop packaged launch smoke
   - server bundle smoke
   - container deployment smoke
   - kubernetes deployment smoke
3. Keep future provider review work limited to official pages that still reveal a real shared
   modeling gap, not metadata churn for already-covered providers.
