> Migrated from `docs/release/release-2026-04-08-86.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-08-86

## Highlights

- Continued the real `Step 07 / CP07-3` page-hotspot work by moving capability and management-entry tone mapping into the dedicated Instance Detail presentation helper module.
- Preserved the authority split so `InstanceDetail.tsx` still owns `instanceService.*`, `toast.*`, `loadWorkbench(...)`, selection state, dialog state, and readonly guards while the presentation module owns only pure tone mapping.
- Re-based the current worktree hotspot profile after this loop at `InstanceDetail.tsx: 2242`, `instanceDetailWorkbenchPresentation.ts: 195`, `instanceWorkbenchServiceCore.ts: 1030`, and `instanceServiceCore.ts: 1274`.

## Attempt Outcome

- Expanded the shared presentation boundary in:
  - `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts`
- Extended focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- Rewired the page to consume the shared tone helpers in:
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Extended the contract suite so the page can no longer drift those helper definitions back inline in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts`
- `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-86.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still the dominant page hotspot, even after the presentation-boundary cleanup.
- This loop intentionally moved only pure tone mapping. Provider Center authority, Local Proxy routing, desktop plugin/runtime boundaries, and all write-path orchestration remained unchanged.
- Rollback must revert the tone-helper exports, the page rewiring, the helper/contract test updates, and the matching review/architecture/release evidence together.

