> Migrated from `docs/release/release-2026-04-08-74.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw skill and tool workbench shaping into dedicated helper modules.
- Realigned the `sdkwork-instances` contract suite and service barrel to the new helper-owned boundaries for skill shaping, tool shaping, scoped tool catalog merging, and related category/access inference.
- Reduced the recorded `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `2379`-line baseline to a fresh `2361` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.test.ts`
- Rewired the workbench core so skill category inference, skill status-entry shaping, tool category inference, tool access inference, scoped tool catalog shaping, and merged multi-agent tool catalog composition no longer live inline in:
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Updated the service barrel so the new helper boundaries stay consumable from the package root in:
  - `packages/sdkwork-claw-instances/src/services/index.ts`
- Extended the contract suite so the new helper boundaries stay enforced in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.ts`
- `packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.ts`
- `packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-claw-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-74.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot and `instanceWorkbenchServiceCore.ts` still remains above closure size at `2361` lines.
- The extraction intentionally moved pure helper logic only. Gateway selection, studio bridge routing, backend truth-source selection, and page-owned side effects remain where they were.
- Rollback must revert both new helper modules, the service-core import rewiring, the service-barrel export changes, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

