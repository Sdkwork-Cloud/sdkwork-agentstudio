> Migrated from `docs/review/step-03-kernel-center-compat-locale-sync-and-openclaw-channel-label-normalization-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced `CP03-4` by closing the real workspace lint blockers that surfaced after the stale `@monaco-editor/react` frontier was disproved.
- Synced the compatibility locale bundles `packages/sdkwork-claw-i18n/src/locales/en.json` and `packages/sdkwork-claw-i18n/src/locales/zh.json` with the split settings locale resources so `Kernel Center` startup-evidence copy is visible to aggregate-bundle consumers again.
- Normalized built-in OpenClaw channel definition names in `openClawConfigService` to English source literals so the i18n hygiene gate no longer fails on non-locale Chinese text.

## Attempt Outcome

- Real frontier audit:
  - `scripts/sdkwork-instances-contract.test.ts` already passed, so the previously documented `@monaco-editor/react` blocker was stale and not the current Step 03 frontier.
  - fresh `pnpm.cmd lint` instead failed in `scripts/sdkwork-settings-contract.test.ts` because the aggregate locale bundles had not been resynced after earlier startup-evidence keys were added to the split `settings.json` locale resources.
- Root cause 1:
  - `packages/sdkwork-claw-i18n/src/locales/en/settings.json` and `packages/sdkwork-claw-i18n/src/locales/zh/settings.json` already contained the new startup-evidence section and field labels introduced by the recent `Kernel Center` loops.
  - compatibility aggregate bundles `packages/sdkwork-claw-i18n/src/locales/en.json` and `packages/sdkwork-claw-i18n/src/locales/zh.json` were still missing those keys.
  - `scripts/sdkwork-settings-contract.test.ts` therefore read stale aggregates and failed even though the source locale resources were already correct.
- Root cause 2:
  - once the locale aggregates were resynced, `packages/sdkwork-claw-i18n/src/index.test.ts` exposed the next real blocker.
  - `packages/sdkwork-claw-core/src/services/openClawConfigService.ts` still embedded Chinese channel names (`SDKWORK公众号`, `微信公众号`) in source constants.
  - the i18n index gate only permits Chinese text in approved locale resources, so those hardcoded source literals kept the workspace from closing the loop.
- Implemented the narrow repair:
  - reran `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales` to regenerate compatibility aggregate bundles from the split locale files.
  - normalized `OPENCLAW_CHANNEL_DEFINITIONS` source names to `SDKWORK Official Account` and `WeChat Official Account`.
  - updated `openClawConfigService.test.ts` expectations to match the source-of-truth channel definitions.
- Actual workspace result:
  - aggregate-locale consumers and split-locale consumers now expose the same startup-evidence labels.
  - the OpenClaw channel catalog still keeps localized UI copy in locale resources, while the shared core source constants stay ASCII/English and pass the locale hygiene gate.
  - no host/shell/foundation boundary changed.

## OpenClaw Fact Sources

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - browser-hosted built-in OpenClaw workbench keeps channel template names in English source constants, so shared core service constants should stay compatible with that contract.
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - browser-hosted workbench tests freeze the built-in OpenClaw channel and runtime surface as managed metadata, not locale-owned source literals.
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - the shell consumes channel and provider projections through translated UI surfaces rather than hardcoding Chinese source labels in service logic.
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - config-schema tooling still relies on schema labels and metadata hints instead of embedding locale-specific strings in shared runtime code.
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
  - the channel workspace is built from `openClawConfigService.getChannelDefinitions()`, so the shared definition names must remain stable and runtime-safe.
- `packages/sdkwork-claw-market/src/services/marketService.ts`
  - ClawHub and OpenClaw integrations continue to resolve runtime services through package-root loaders, reinforcing that this loop should remain a narrow contract/data hygiene repair rather than a new transport path.
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
  - agent installation still resolves writable OpenClaw config files through `openClawConfigService`, so the channel-definition source remains a shared core fact surface.
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - provider-center management state continues to come from runtime/detail facts, not from localized source literals.
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace behavior still sits above managed-runtime facts and is unaffected by this locale-sync repair.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - built-in runtime/proxy services remain part of the managed OpenClaw fact chain but did not require code changes for this loop.
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - desktop plugin wiring also stayed unchanged; this loop remained inside i18n aggregate assets and core config metadata.

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `pnpm.cmd lint`

## Architecture Writeback

- No `docs/架构/` delta was required.
- This loop only resynced compatibility locale artifacts and normalized source literals; it did not change package boundaries, host/shell ownership, runtime truth sources, or OpenClaw control-plane architecture.

## Remaining Gaps

- Step 03 remains open.
- The workspace lint gates are green again, but the next real frontier still has to be discovered by fresh evidence instead of reusing stale execution notes.
- This loop intentionally did not broaden into unrelated build cleanup or desktop runtime changes.

## Risks And Rollback

- The main risk is future drift between split locale resources and compatibility aggregate bundles if `sync:locales` is skipped after settings copy changes.
- A secondary risk is reintroducing non-locale Chinese literals into shared source files, which would break the i18n hygiene gate again.
- Rollback is limited to the aggregate locale bundle sync, the two OpenClaw channel-name constants, the aligned test expectations, and the related review/release ledger updates.

