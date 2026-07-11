> Migrated from `docs/release/release-2026-04-08-55.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier with another verified page-hotspot decomposition loop.
- Extracted two additional Instance Detail sections into dedicated components:
  - `memory`
  - `tools`
- Reduced `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` from `4751` lines to `4564` lines on fresh measurement.
- Kept the full Step 07 verification matrix green after the additional decomposition.

## Attempt Outcome

- Added and verified new contract coverage in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Added the new section components:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailMemorySection.tsx`
  - `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailToolsSection.tsx`
- Updated orchestration and barrel exports:
  - `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-agentstudio-pc-instances/src/components/index.ts`
- Updated the ongoing Step 07 progress evidence:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/components/index.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailMemorySection.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailToolsSection.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-55.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `llmProviders` plus the two service hotspots are still oversized.
- This loop only changes render ownership boundaries and keeps the OpenClaw truth-source chain unchanged.
- Rollback must revert the extracted section components and the matching contract assertions together; reverting only one side would recreate ownership drift.

