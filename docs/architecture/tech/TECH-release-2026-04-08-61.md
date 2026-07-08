> Migrated from `docs/release/release-2026-04-08-61.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier by moving managed-config and provider-dialog save-input parsing out of `InstanceDetail.tsx` and into dedicated pure service helpers.
- Kept the page as the owner of UI side effects only: toast feedback, saving flags, dialog state, and workbench reloads still stay in `InstanceDetail.tsx`.
- Reduced the full `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` hotspot from `3142` to `2702` lines on fresh measurement.

## Attempt Outcome

- Added pure draft helper modules:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
- Added focused helper tests:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired page orchestration to use helper-built inputs instead of inline parsing and validation:
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- Tightened contract coverage in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 progress evidence:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-61.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` still carries several render/orchestration wrappers and the two service core hotspots remain at `3479` and `1480` lines.
- The extraction intentionally changes ownership only, not truth-source semantics: OpenClaw provider authority still comes from `openClawManagementCapabilities.ts`, `openClawProviderWorkspacePresentation.ts`, `instanceService.test.ts`, and `webStudio.test.ts`.
- Rollback must revert the page rewiring, the helper modules, the helper tests, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would reintroduce ownership drift.

