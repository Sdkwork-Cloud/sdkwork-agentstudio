> Migrated from `docs/release/release-2026-04-08-63.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier by moving the remaining `llmProviders` composition wrapper out of `InstanceDetail.tsx` into a dedicated component.
- Kept the page as the owner of UI side effects and write-path callbacks only: toast feedback, saving flags, dialog state, delete ids, and workbench reloads still stay in `InstanceDetail.tsx`.
- Reduced the full `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` hotspot from `2635` to `2618` lines on fresh measurement, and removed the former provider/agent render wrappers from the hotspot frontier.

## Attempt Outcome

- Added a dedicated provider composition component:
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`
- Exported reusable props contracts from the lower-level provider section/dialog components:
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx`
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProviderDialogs.tsx`
- Rewired page orchestration so the page now hands off provider section/dialog composition to the new component and prebuilds provider/agent prop bundles instead of keeping bulky render wrappers inline:
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Tightened contract coverage so the page cannot regress back to directly owning the provider composition wrapper or the old agent/provider inline prop wiring shape:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 progress evidence:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProviderDialogs.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`
- `packages/sdkwork-claw-instances/src/components/index.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-63.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `handleSubmitProviderModelDialog`, `handleSubmitProviderDialog`, and the tools/memory renderers still keep the page oversized, and the two service-core hotspots remain at `3819` and `1664` lines.
- The extraction intentionally changes render ownership only, not truth-source semantics: OpenClaw provider and provider-model authority still comes from `openClawManagementCapabilities.ts`, `openClawProviderWorkspacePresentation.ts`, `instanceService.test.ts`, and `webStudio.test.ts`.
- Rollback must revert the new composition component, the page rewiring, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would reintroduce ownership drift.

