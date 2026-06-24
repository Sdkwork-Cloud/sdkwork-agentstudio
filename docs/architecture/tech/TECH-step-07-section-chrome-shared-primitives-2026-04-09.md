> Migrated from `docs/review/step-07-section-chrome-shared-primitives-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Section Chrome Shared Primitives - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - repair the `InstanceDetail.tsx` section-chrome boundary regression detected by fresh contract verification
  - keep OpenClaw truth-source ownership unchanged while moving pure section chrome back into the shared primitive layer
  - refresh Step 07 evidence on the current real worktree instead of relying on stale prior-loop claims

## Root Cause

- Fresh `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts` failed on the current worktree.
- The concrete regression was not a runtime behavior failure; it was a boundary failure:
  - `InstanceDetail.tsx` had drifted back to owning inline `SectionHeading(...)`
  - `InstanceDetail.tsx` had drifted back to owning inline `SectionAvailabilityNotice(...)`
- That directly violated the existing Step 07 contract that page-level section chrome must stay in `InstanceWorkbenchPrimitives.tsx`.

## Implemented Repair

- Restored section chrome ownership to:
  - `packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx`
    - `SectionHeading(...)`
    - `SectionAvailabilityNotice(...)`
- Rewired:
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
    - now imports `SectionHeading` and `SectionAvailabilityNotice` from the shared primitive module
    - no longer defines those two helpers inline
    - still owns section-availability routing and still passes:
      - `statusLabel={formatWorkbenchLabel(...)}`
      - `statusTone={getCapabilityTone(...)}`
      - `detail={availability.detail}`

## Boundary Decision

- The primitive module now owns only the shared section chrome shell.
- The dedicated presentation helper module still owns:
  - `getCapabilityTone(...)`
  - other tone/badge/schedule presentation helpers
- The page still owns:
  - truth-source routing
  - section-availability branching
  - all OpenClaw write-path invocation
  - toast and reload side effects
- No new write chain, transport path, or Provider Center authority was moved in this loop.

## OpenClaw Fact Sources Re-read

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - still proves browser-backed workbench detail persists provider edits, files, tasks, and managed channel writes through the real bridge
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - still freezes Control UI section ordering
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - still owns managed OpenClaw authority classification
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - still turns managed-state classification into provider workspace readonly/manageability decisions
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
  - still owns channel write bridging and did not move into the page
- `packages/sdkwork-claw-market/src/services/marketService.ts`
  - still owns market discovery and skill/package install entry points
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
  - still owns writable OpenClaw config path resolution and workspace materialization
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - still owns Local Proxy protocol/runtime boundaries
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - still owns desktop plugin registration

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `2423`
- `packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx`: `87`
- `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `206`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately pre-fix page state (`2453` lines), this loop reduces `InstanceDetail.tsx` to `2423` while restoring the intended shared section-chrome boundary.

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- Additional fresh verification:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - `pnpm check:sdkwork-instances`

All commands passed on fresh execution after the shared-primitive repair landed.

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: still pending final closure writeback

This loop restores one architecture contract and removes one page-side regression, but it does not close Step 07. The page hotspot and the two service-core hotspots still require further decomposition.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` from the current `2423`-line real baseline without moving write authority out of the page.
- Re-evaluate the next page-local pure helper or composition residue after the restored primitive boundary.
- Keep `instanceWorkbenchServiceCore.ts` and `instanceServiceCore.ts` under the same CP07-3 watchlist; neither is yet at a closure-ready size.

