> Migrated from `docs/release/release-2026-04-09-87.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-87

## Highlights

- Upgraded the bundled OpenClaw baseline from `2026.4.2` to `2026.4.8` after re-checking the official upstream latest version on `2026-04-09`.
- Re-read the upstream `v2026.4.8` release notes and translated the real runtime impact into the desktop prepare chain instead of stopping at version-string updates.
- Repaired bundled runtime preparation for the new native prebuild surface so `@discordjs/opus` now hydrates correctly under `npm install --ignore-scripts`.
- Regenerated the desktop OpenClaw runtime and re-aligned bundled/generated manifests, release contracts, and desktop verification gates on `2026.4.8`.

## Attempt Outcome

- Official latest verification:
  - `npm view openclaw version dist-tags --json` resolved `latest = 2026.4.8`
  - `https://api.github.com/repos/openclaw/openclaw/releases/latest` resolved `tag_name = v2026.4.8`, published `2026-04-08T05:59:44Z`
- Upstream release notes re-read for this upgrade:
  - Telegram/setup and bundled channels/setup now load packaged top-level sidecars
  - bundled plugin compatibility metadata aligned to `2026.4.8`
  - OpenAI-family runs keep `update_plan` available
  - `/exec` host-aware default reporting aligned with runtime behavior
  - Slack proxy/token fixes and trusted env-proxy fetch-guard changes landed upstream
- Real failure found and repaired:
  - the first real `prepare-openclaw-runtime --force` run failed during smoke load because `@discordjs/opus` could not find `prebuild/.../opus.node`
  - the runtime install path intentionally uses `--ignore-scripts`, so `node-pre-gyp install --fallback-to-build` never ran automatically
  - added a RED/GREEN regression for `@discordjs/opus` downloaded native runtime asset resolution and tar.gz staging
  - updated `scripts/prepare-openclaw-runtime.mjs` so the desktop runtime prepare chain now resolves and extracts the downloaded `@discordjs/opus` prebuild archive before smoke load
- Fresh workspace result:
  - `node scripts/openclaw-upgrade-readiness.mjs 2026.4.8` now reports `versionSourcesAligned: true`
  - the real runtime prepare finished successfully and re-generated the bundled desktop OpenClaw resource tree at `2026.4.8`
  - both `pnpm check:desktop-openclaw-runtime` and `pnpm check:desktop` passed after regeneration

## Change Scope

- `config/openclaw-release.json`
- `packages/sdkwork-claw-desktop/src-tauri/foundation/components/component-registry.json`
- `scripts/openclaw-release-contract.test.mjs`
- `scripts/verify-desktop-openclaw-release-assets.test.mjs`
- `scripts/prepare-openclaw-runtime.mjs`
- `scripts/prepare-openclaw-runtime.test.mjs`
- `docs/review/2026-04-09-openclaw-2026.4.8-upgrade-review.md`
- `docs/架构/README.md`
- `docs/架构/02-架构标准与总体设计.md`
- `docs/架构/12-安装、部署、发布与商业化交付标准.md`
- `docs/架构/135-2026-04-09-openclaw-2026.4.8-native-prebuild-upgrade-guard.md`
- `docs/release/release-2026-04-09-87.md`
- `docs/release/releases.json`

## Verification Focus

- RED: `node scripts/prepare-openclaw-runtime.test.mjs`
- GREEN: `node scripts/prepare-openclaw-runtime.test.mjs`
- `node scripts/openclaw-release-contract.test.mjs`
- `node scripts/openclaw-upgrade-readiness.mjs 2026.4.8`
- `OPENCLAW_PACKAGE_TARBALL=... OPENCLAW_FORCE_PREPARE=true node scripts/prepare-openclaw-runtime.mjs --force`
- `pnpm check:desktop-openclaw-runtime`
- `pnpm check:desktop`

## Risks And Rollback

- The main forward risk is not version metadata anymore; it is future upstream additions to `pnpm.onlyBuiltDependencies` or other install-script-downloaded native packages that would need the same explicit runtime hydration treatment.
- This loop intentionally keeps the repair narrow: version-source alignment, runtime preparation, regenerated bundled resources, and evidence writebacks only.
- Rollback should revert the version-source changes, the `prepare-openclaw-runtime` native-prebuild hydration logic, the regenerated desktop OpenClaw resources, and these matching review/architecture/release writebacks together.

