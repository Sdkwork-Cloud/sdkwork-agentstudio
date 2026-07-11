> Migrated from `docs/release/release-2026-04-08-66.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier by moving provider submit mutation metadata out of `InstanceDetail.tsx` into dedicated helpers and by centralizing managed config save side effects through one page-owned runner.
- Kept the page as the owner of actual OpenClaw write-path invocation, toast dispatch, reload wiring, and state reset semantics.
- Reduced the full `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` hotspot from `2575` to `2571` lines on fresh measurement, while further shrinking duplicated orchestration shells around provider and managed-config saves.

## Attempt Outcome

- Extended provider helper ownership in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired page orchestration so provider submit handlers now consume provider mutation plans from the helper layer and managed config save handlers share one page-owned side-effect runner:
  - `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- Tightened the contract suite so the page cannot regress back to the old managed-save boilerplate or inline provider submit metadata shape:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 progress evidence:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-66.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `handleSubmitProviderModelDialog` and `handleSubmitProviderDialog` still dominate the page hotspot list, and the two service-core hotspots remain at `3819` and `1664` lines.
- The extraction intentionally changes orchestration shape only, not authority routing: OpenClaw provider and managed-config writes still go through the existing `instanceService` paths and remain constrained by `webStudio.test.ts`, `instanceService.test.ts`, `openClawManagementCapabilities.ts`, and `openClawProviderWorkspacePresentation.ts`.
- Rollback must revert the provider helper expansion, the page rewiring, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would reintroduce decomposition drift.

