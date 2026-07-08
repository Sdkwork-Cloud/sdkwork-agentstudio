> Migrated from `docs/release/release-2026-04-09-88.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-88

## Highlights

- Repaired a Step 07 architecture regression where `InstanceDetail.tsx` had drifted back to owning section chrome that was already meant to live in shared workbench primitives.
- Restored `SectionHeading` and `SectionAvailabilityNotice` to `InstanceWorkbenchPrimitives.tsx` while keeping page-owned OpenClaw truth routing, write-path invocation, and side effects unchanged.
- Re-ran the focused Step 07 verification set and the package-level `check:sdkwork-instances` gate on the current real worktree.

## Attempt Outcome

- Fresh red surfaced the real current-worktree issue:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed because `InstanceDetail.tsx` still contained inline `SectionHeading(...)` and `SectionAvailabilityNotice(...)`
- Implemented the narrow repair:
  - added `SectionHeading(...)` and `SectionAvailabilityNotice(...)` back to `packages/sdkwork-clawstudio-instances/src/components/InstanceWorkbenchPrimitives.tsx`
  - rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` to import those primitives
  - removed the inline page definitions
  - kept `getCapabilityTone(...)` in `instanceDetailWorkbenchPresentation.ts` and `formatWorkbenchLabel(...)` in the shared formatting helper, so this loop fixed the chrome boundary without moving authority-bearing logic
- Fresh OpenClaw fact-source re-read confirmed no authority drift across:
  - `webStudio.test.ts`
  - `openClawConfigSchemaSupport.test.ts`
  - `openClawManagementCapabilities.ts`
  - `openClawProviderWorkspacePresentation.ts`
  - `channelService.ts`
  - `marketService.ts`
  - `agentInstallService.ts`
  - `local_ai_proxy.rs`
  - `plugins/mod.rs`
- Current hotspot profile after the repair:
  - `InstanceDetail.tsx`: `2423`
  - `InstanceWorkbenchPrimitives.tsx`: `87`
  - `instanceDetailWorkbenchPresentation.ts`: `206`
  - `instanceWorkbenchServiceCore.ts`: `1132`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop repaired a page-boundary regression and re-locked the contract, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/components/InstanceWorkbenchPrimitives.tsx`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `docs/review/step-07-section-chrome-shared-primitives-2026-04-09.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-88.md`
- `docs/release/releases.json`

## Verification Focus

- RED: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN: `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `pnpm check:sdkwork-instances`

## Risks And Rollback

- The main risk here is future page-side churn re-inlining shared section chrome again while other CP07-3 decomposition continues.
- This loop intentionally does not alter transport selection, provider management authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the shared primitive export additions, the page import/removal of inline helpers, and the matching review/architecture/release writebacks.

