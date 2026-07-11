> Migrated from `docs/release/release-2026-04-08-53.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Fresh `Step 07` verification confirms the Instance Directory and Instance Detail workbench behavior is broadly green on the current worktree.
- `Step 07` is still not closable yet: the core workbench hotspots remain too monolithic to satisfy `CP07-3`, even though the service and contract matrix is passing.
- This loop records the blocker formally so the next iteration can target hotspot decomposition directly instead of repeating the same audit.

## Attempt Outcome

- Re-ran the `Step 07` verification set:
  - `pnpm.cmd check:sdkwork-instances`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- Verified that the current implementation already covers:
  - instance directory and detail/workbench truth via backend detail plus OpenClaw gateway overlays
  - ten-section workbench behavior and config semantics
  - managed OpenClaw control-plane boundaries and Control UI section ordering
- Fresh blocker evidence:
  - `InstanceDetail.tsx`: `5328` lines
  - `instanceWorkbenchServiceCore.ts`: `3479` lines
  - `instanceServiceCore.ts`: `1480` lines
- Result:
  - `Step 07` remains in progress
  - next frontier is hotspot decomposition, not closure evidence

## Change Scope

- `docs/review/step-07-执行卡-2026-04-08.md`
- `docs/release/release-2026-04-08-53.md`
- `docs/release/releases.json`

## Verification Focus

- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- This loop changes review / release evidence only; rollback is limited to those documents.
- The primary remaining risk is treating passing service tests as proof of Step 07 closure while the main workbench hotspots still violate the step card's decomposition requirement.

