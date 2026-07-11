> Migrated from `docs/release/release-2026-04-08-83.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Agent Studio release-2026-04-08-83

## Highlights

- Continued the real `Step 07 / CP07-3` page hotspot work by moving provider draft field/config/request mutation logic into shared provider draft helpers.
- Preserved the page authority split so `InstanceDetail.tsx` still owns readonly/selection guards and the actual draft state entry points, while the helper layer owns only pure draft-map shaping.
- Re-baselined the current hotspot profile at `InstanceDetail.tsx = 2811`, `openClawProviderDrafts.ts = 561`, `instanceWorkbenchServiceCore.ts = 1132`, and `instanceServiceCore.ts = 1431`; the page hotspot is effectively flat, so `CP07-3` remains open.

## Attempt Outcome

- Expanded shared provider draft helpers in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.ts`
- Expanded focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired provider draft mutation handlers in:
  - `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- Extended the contract suite so the page stays on the new helper boundary in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-83.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still the dominant hotspot at a fresh `2811` lines.
- This loop intentionally moved only pure provider draft mutation logic. Provider write authority, Provider Center managed classification, Local Proxy routing, and desktop plugin/runtime boundaries remained unchanged.
- Rollback must revert the provider draft mutation helpers, the page rewiring, the helper/contract test updates, and the matching review/architecture/release evidence together.

