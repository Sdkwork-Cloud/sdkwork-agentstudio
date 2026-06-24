> Migrated from `docs/release/release-2026-04-08-49.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced `CP03-4` by resyncing `Kernel Center` startup-evidence compatibility locale bundles and normalizing OpenClaw channel-definition source labels.
- The real current blockers were the stale aggregate locale bundles and non-locale Chinese source literals, not the previously documented `@monaco-editor/react` frontier.
- Fresh targeted verification plus full `pnpm.cmd lint` returned green after the repair.

## Attempt Outcome

- The loop repaired the next real Step 03 workspace lint blocker chain:
  - `scripts/sdkwork-instances-contract.test.ts` already passed, so the previous `@monaco-editor/react` note was stale
  - fresh `pnpm.cmd lint` failed in `scripts/sdkwork-settings-contract.test.ts` because `packages/sdkwork-claw-i18n/src/locales/en.json` and `packages/sdkwork-claw-i18n/src/locales/zh.json` had drifted behind the split `settings.json` locale resources that already carried the `Kernel Center` startup-evidence copy
  - after the locale aggregates were resynced, `packages/sdkwork-claw-i18n/src/index.test.ts` exposed the next blocker: Chinese channel-name literals still embedded in `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- Implemented the narrow repairs:
  - regenerated the aggregate locale bundles with `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  - normalized the built-in OpenClaw channel definition names to `SDKWORK Official Account` and `WeChat Official Account`
  - updated `openClawConfigService.test.ts` expectations to the new shared source constants
- Fresh verification:
  - `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
  - `pnpm.cmd lint`

## Change Scope

- `packages/sdkwork-claw-core/src/services/openClawConfigService.ts`
- `packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `docs/review/step-03-kernel-center-compat-locale-sync-and-openclaw-channel-label-normalization-2026-04-08.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-49.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `pnpm.cmd lint`

## Risks And Rollback

- The main risk remains future drift between split locale resources and compatibility aggregate bundles if `sync:locales` is skipped after settings-copy changes.
- A second risk is reintroducing non-locale Chinese literals into shared source files, which would break the i18n hygiene gate again.
- Rollback is limited to the aggregate locale sync, the two OpenClaw channel-name constants, the aligned test expectations, and the corresponding review/release ledger updates.

