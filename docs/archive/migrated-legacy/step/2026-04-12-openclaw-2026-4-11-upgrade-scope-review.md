# OpenClaw 2026.4.11 Upgrade Scope Review

**Date:** 2026-04-12

## Baseline

Current Claw Studio workspace still spans three different OpenClaw baselines:

- shared bundled release metadata: `2026.4.9`
- local upstream checkout under `.cache/bundled-components/upstreams/openclaw`: `2026.4.9`
- stale legacy source runtime residue under `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime`: `2026.3.28`

Upstream latest is `v2026.4.11`.

That means the upgrade problem is not a single version bump. It is a mixed state problem:

1. old source residue still exists locally
2. the bundled release metadata is still pinned to `2026.4.9`
3. the local offline upgrade inputs for `2026.4.11` do not exist yet

## Upstream Review

### 2026.4.10

High-signal upstream changes between `2026.4.9` and `2026.4.10`:

- Codex/provider setup: OpenClaw started shipping bundled Codex provider support plus onboarding and auth handling for Codex chat/completion flows.
- Plugins/app-server harness: plugin app-server setup and tool registration moved toward a more explicit harness contract.
- OpenAI-compatible runtime config: private-network request support and auth/setup improvements changed provider request behavior.
- Fixes touched gateway/model startup behavior, auth, command execution, and packaged runtime expectations.

Impact on Claw Studio:

- medium-to-high impact for the local AI proxy and bundled desktop runtime because Claw Studio embeds the npm package, projects provider config, and manages gateway startup
- medium impact for account/auth flows because Codex sign-in is a user-visible surface
- low impact for channel-specific features that Claw Studio does not actively broker in the desktop startup path

### 2026.4.11

High-signal upstream changes between `2026.4.10` and `2026.4.11`:

- OpenAI/Codex OAuth fix: upstream stopped rewriting authorize scopes, fixing `invalid_scope` failures on fresh Codex sign-ins.
- Plugins activation/setup descriptors: plugin setup became more declarative and less hardcoded.
- OpenAI-compatible endpoint classification logs: debug output is richer for local/proxy route diagnosis.
- QA/packaging fix: packaged CLI startup and completion cache generation no longer reads repo-only QA markdown, bundled QA scenario packs ship in npm releases, and `openclaw completion --write-state` remains usable even when QA setup is broken.

Impact on Claw Studio:

- **direct packaging/runtime impact:** the QA/packaging fix is relevant because Claw Studio prepares and bundles the npm package into a desktop runtime archive
- **direct auth impact:** the Codex OAuth fix matters for integrated sign-in reliability
- **medium integration impact:** plugin activation/setup descriptors may affect future setup flows, but they are not the primary desktop startup blocker
- **low startup impact:** Dreaming, Feishu, Teams, WhatsApp, Telegram, and media-generation changes are mostly feature-surface changes outside the bundled desktop runtime authority path

## Local Risk Assessment

### Must absorb before claiming a real 2026.4.11 upgrade

- upstream `v2026.4.11` source or a verified local `openclaw-2026.4.11.tgz`
- local upstream checkout containing git tag `v2026.4.11`
- refreshed bundled release metadata and manifests
- refreshed packaged runtime resources
- refreshed contract tests pinned to `2026.4.11`

### Must clean even before the real upgrade can proceed

- remove stale `src-tauri/resources/openclaw-runtime` source residue
- keep release verification failing fast if that residue reappears
- keep readiness diagnostics explicit about missing offline upgrade inputs

### Already aligned with the existing runtime-authority plan

The current runtime-authority and kernel-adapter work remains the correct architectural response. The upstream changelog does not invalidate that plan. Instead, `2026.4.11` increases the value of that plan because:

- packaging correctness matters more as upstream npm release contents evolve
- auth and provider behavior is moving faster, so host-owned migration and upgrade bookkeeping must stay explicit
- multi-kernel abstractions benefit from keeping version and config ownership out of runtime-managed config files

## Current Hard Blockers

As of 2026-04-12, the workspace cannot perform a real offline bundled upgrade to `2026.4.11` because:

- `config/openclaw-release.json` is still pinned to `2026.4.9`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json` is still `2026.4.9`
- `.cache/bundled-components/upstreams/openclaw/package.json` is still `2026.4.9`
- local upstream checkout does not expose git tag `v2026.4.11`
- no local `openclaw-2026.4.11.tgz` is available
- stale `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime` residue still exists locally and reports `2026.3.28`

## Decision

Do not fake the upgrade by editing version strings only.

The correct sequence is:

1. remove the legacy `openclaw-runtime` source residue
2. stage real local offline `2026.4.11` assets
3. run readiness again
4. update release metadata and bundled resources
5. rerun desktop release verification and runtime checks
