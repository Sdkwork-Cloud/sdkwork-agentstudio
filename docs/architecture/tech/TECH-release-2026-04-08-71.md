> Migrated from `docs/release/release-2026-04-08-71.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw channel and agent workbench shaping into dedicated helper modules.
- Repaired a real managed-agent deduplication defect by normalizing managed snapshot ids before runtime overlay, and realigned the contract suite to the new helper-owned evidence path.
- Reduced the recorded `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `2924`-line baseline to a fresh `2635` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentWorkbenchSupport.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- Rewired the workbench core so channel mapping/clone/merge and agent mapping/clone/normalize/merge/build-managed logic no longer live inline in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- Updated the service barrel so the new helper boundaries stay consumable from the package root in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`
- Realigned the stale contract evidence path in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentWorkbenchSupport.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-71.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot and `instanceWorkbenchServiceCore.ts` still remains above closure size at `2635` lines.
- The extraction intentionally moved pure helper logic only. Gateway selection, studio bridge routing, backend truth-source selection, and page-owned side effects remain where they were.
- Rollback must revert the two new helper modules, the service-core import rewiring, the service-barrel export changes, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

