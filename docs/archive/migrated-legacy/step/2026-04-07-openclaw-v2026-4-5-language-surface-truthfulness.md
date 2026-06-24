# OpenClaw v2026.4.5 Language Surface Truthfulness

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Scope

- Re-review the current OpenClaw-aligned language surface after the earlier locale-expansion work.
- Verify whether the local settings UI truthfully distinguishes dedicated translations from
  fallback-backed locales.
- Record the exact remaining gap instead of claiming full translation parity.

## Step 1: Upstream and local locale-source re-review

Review date:

- 2026-04-07

Local upstream locale files currently present in
`.cache/bundled-components/upstreams/openclaw/ui/src/i18n/locales`:

- `de.ts`
- `en.ts`
- `es.ts`
- `pt-BR.ts`
- `zh-CN.ts`
- `zh-TW.ts`

Local app locale-source reality in this workspace:

- Dedicated split source bundles are still maintained only for:
  - `packages/sdkwork-claw-i18n/src/locales/en/*`
  - `packages/sdkwork-claw-i18n/src/locales/zh/*`
- The app runtime already accepts a broader language surface in
  `packages/sdkwork-claw-i18n/src/config.ts`.
- That means the language picker can expose more locale codes than the repo currently translates
  natively.

Interpretation:

1. The local app should not regress back to an artificially narrow `en/zh` runtime surface.
2. The local app also must not imply that every exposed locale already has a dedicated local
   translation bundle.
3. The correct immediate fix is truthfulness in the shared i18n metadata and settings UI.

## Step 2: Real UX truthfulness gap found in the current source

Before this loop, the expanded settings language selector still had one misleading behavior:

- It rendered all supported locale choices as if they were equivalent full translations.

Why that was a real architecture issue:

1. The same selector is consumed through the shared package stack, so the misleading language
   surface would ship consistently across web, desktop, server-hosted, Docker, and k8s packaging.
2. The current repo still reuses `en` or `zh` bundles underneath for many exposed locale codes.
3. A user choosing `fr`, `ja`, `pt-BR`, or `zh-TW` could reasonably infer that Claw Studio had a
   dedicated translation for that locale when it did not.

Conclusion:

- `Control UI language surface` should remain `partially-aligned`, but the UI must become explicit
  about fallback-backed locales.

## Step 3: Chosen landing strategy

Accepted strategy:

- Keep the broader runtime language surface already landed.
- Add shared metadata that declares which locales have dedicated source bundles and which locales
  resolve through fallback bundles.
- Switch the visible language labels to native/autonym labels where currently available.
- Surface fallback notes directly in the settings selector and for the currently selected explicit
  language.
- Preserve a truthful Chinese fallback string without directly patching the encoding-dirty
  `packages/sdkwork-claw-i18n/src/locales/zh/settings.json` file in this environment.

Rejected alternatives:

1. Pretend all exposed locales are fully translated.
   - Rejected because that would keep the current UI misleading.
2. Remove every fallback-backed locale from the selector immediately.
   - Rejected because the wider runtime surface is already part of the local OpenClaw-aligned
     architecture and still functions correctly through deterministic fallback bundles.
3. Claim full parity with upstream locale coverage.
   - Rejected because the local repo still maintains only `en` and `zh` as dedicated source
     bundles.

## Step 4: Files changed in this loop

- `packages/sdkwork-claw-i18n/src/config.ts`
  - added dedicated-bundle metadata helpers and native language labels
- `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
  - renders per-locale fallback notes and an explicit fallback note for the active language
- `packages/sdkwork-claw-i18n/src/index.test.ts`
  - asserts language metadata truthfulness and bundle-source behavior
- `packages/sdkwork-claw-i18n/src/locales/en/settings.json`
  - adds the shared `settings.general.languageFallbackTo` copy
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
  - injects the matching Chinese fallback string as a runtime override
- `packages/sdkwork-claw-i18n/src/locales/README.md`
  - documents that fallback-backed locales must be surfaced honestly
- `scripts/sdkwork-settings-contract.test.ts`
  - asserts the settings surface uses the new fallback metadata helpers
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

Important implementation note:

- The Chinese fallback string currently lives in `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
  instead of `packages/sdkwork-claw-i18n/src/locales/zh/settings.json` because the split JSON file
  is encoding-dirty in this environment and was not safe to patch directly in this loop.

## Step 5: Verification evidence

Focused verification re-run for this landing:

- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `pnpm.cmd check:i18n`
  - passed

Verification feedback:

1. Locale compatibility bundles regenerated cleanly after the metadata and copy changes.
2. Shared i18n tests now prove both native-label coverage and truthful bundle-source mapping.
3. Settings contract checks confirm the fallback metadata is rendered through the shared settings
   package rather than a host-specific patch.

## Step 6: Current status after this loop

Improved locally:

1. The settings language selector no longer implies that every exposed locale is fully translated.
2. Native language labels and explicit fallback annotations now make the current translation
   surface materially more truthful.
3. The same truthfulness improvement applies across all host modes because it lives in shared
   `i18n/settings` packages.

Still not fully aligned:

1. Only `en` and `zh` remain dedicated local translation source bundles in this repo.
2. Upstream dedicated bundles such as `de`, `es`, `pt-BR`, and `zh-TW` are not yet imported and
   maintained locally.
3. Some exposed locales still intentionally reuse fallback bundles, so `Control UI language
   surface` remains `partially-aligned` rather than `aligned`.

Recommended next action:

- Keep the truthful fallback UI that landed here.
- Treat future full-language parity as a separate import-and-maintenance task, ideally after the
  bundled runtime baseline is refreshed and the upstream locale source can be re-synced cleanly.
