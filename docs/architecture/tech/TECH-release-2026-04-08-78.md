> Migrated from `docs/release/release-2026-04-08-78.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Agent Studio release-2026-04-08-78

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw runtime channel shaping into the existing shared channel helper.
- Preserved the authority split so the service core still decides when to probe the gateway, while the helper now owns only the pure shaping of the returned channel payload.
- Reduced the recorded `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `1209`-line baseline to a fresh `1030` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Expanded the existing helper boundary in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.ts`
- Expanded focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- Rewired the workbench core so runtime channel-shaping helpers no longer live inline in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- Kept gateway probing, error swallowing, and truth-source routing in the service core.
- Extended the contract suite so the removed channel runtime helpers stay outside the core hotspot in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-78.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot even though `instanceWorkbenchServiceCore.ts` is now down to `1030` lines.
- The extraction intentionally moved pure runtime channel shaping only. Gateway selection, gateway probe timing, backend truth-source selection, page-owned side effects, provider-management classification, and local proxy/plugin runtime boundaries remain where they were.
- Rollback must revert the expanded channel helper, the helper test additions, the service-core import rewiring, the contract boundary updates, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

