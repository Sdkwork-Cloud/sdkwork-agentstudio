> Migrated from `docs/release/release-2026-04-08-54.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier instead of stopping at blocker evidence.
- Extracted four Instance Detail render slices into dedicated components:
  - `overview`
  - `files`
  - `channels`
  - `skills`
- Reduced `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` from `5328` lines to `4751` lines on fresh measurement.
- Kept the Step 07 verification matrix green after each decomposition cycle.

## Attempt Outcome

- Added and verified new section-level contract coverage in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Added the new section components:
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailOverviewSection.tsx`
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailFilesSection.tsx`
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx`
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailSkillsSection.tsx`
  - `packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx`
- Updated page orchestration and component exports:
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-claw-instances/src/components/index.ts`
- Wrote the supporting review and architecture evidence:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/components/index.ts`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailOverviewSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailFilesSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSkillsSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-54.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because the page and two service hotspots are still oversized.
- The current iteration changes render ownership boundaries but does not change the OpenClaw truth-source chain.
- Rollback can be done by reverting the extracted section components and the associated contract assertions together; partial rollback would reintroduce page-level ownership drift.

