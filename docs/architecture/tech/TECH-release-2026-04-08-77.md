> Migrated from `docs/release/release-2026-04-08-77.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-08-77

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw workbench snapshot assembly and section-availability composition into a dedicated helper module.
- Realigned the contract suite to the new snapshot-helper routing path after verification exposed stale evidence assumptions, not a runtime regression.
- Reduced the recorded `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `1675`-line baseline to a fresh `1209` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- Rewired the workbench core so backend workbench mapping, snapshot assembly, overview counting, section availability, and detail-only fallback composition no longer live inline in:
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Kept page-owned write-path dispatch, provider-management truth, and gateway/studio/backend truth-source routing in their existing authority files.
- Kept channel shaping owned by `openClawChannelWorkbenchSupport.ts`, but recorded the current routing path explicitly:
  - `instanceWorkbenchServiceCore.ts -> instanceWorkbenchSnapshotSupport.ts -> openClawChannelWorkbenchSupport.ts`
- Updated the service barrel so the new helper boundary stays consumable from the package root in:
  - `packages/sdkwork-claw-instances/src/services/index.ts`
- Extended the contract suite so the new snapshot-helper boundary and the two-hop channel-helper routing stay enforced in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Corrected stale verification evidence uncovered during closure:
  - the detail-only snapshot fixture contributes `8` overview entries, not `7`
  - contract assertions that still pointed `dataAccess`, managed-agent overlay, and direct channel-helper import evidence at `instanceWorkbenchServiceCore.ts` now point at the real snapshot-helper boundary
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-claw-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-77.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot and `instanceWorkbenchServiceCore.ts` still remains at `1209` lines.
- The extraction intentionally moved pure snapshot assembly and section-availability composition only. Gateway selection, studio bridge routing, backend truth-source selection, page-owned side effects, provider-management classification, channel truth, and local proxy/plugin runtime boundaries remain where they were.
- Rollback must revert the new helper module, the helper test, the service-core import rewiring, the service-barrel export change, the contract boundary updates, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

