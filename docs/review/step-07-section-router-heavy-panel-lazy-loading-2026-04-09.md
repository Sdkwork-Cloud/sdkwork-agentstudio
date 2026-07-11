# Step 07 Section Router Heavy Panel Lazy Loading - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining section-router eager import of the heavy `files` and `config` panels
  - keep page-owned write authority, `toast`, and `loadWorkbench(...)` behavior unchanged
  - reduce first-open `InstanceDetail` bundle cost without changing section semantics

## Root Cause

- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx` still statically imported:
  - `InstanceDetailFilesSection.tsx`
  - `InstanceConfigWorkbenchPanel.tsx`
- That meant the section router pulled both heavy surfaces into the main `InstanceDetail` route chunk even when users only opened overview, channels, skills, memory, or tools.
- The new contract RED reproduced this precisely:
  - the router had no `React.lazy(...)`
  - the router had no `React.Suspense`
  - both heavy sections were still eagerly imported

## Implemented Fix

- Replaced the two eager imports with:
  - `LazyInstanceDetailFilesSection`
  - `LazyInstanceConfigWorkbenchPanel`
- Mapped both named exports through `React.lazy(...)` so runtime behavior stays compatible with the existing component modules.
- Added one shared `Suspense` fallback for router-owned loading chrome.
- Kept all existing section routing rules unchanged:
  - `files` still receives the same props
  - `config` still stays gated by `managedConfigPath` and `instanceId`
  - all real writes remain outside the router

## Boundary Decision

- `InstanceDetailSectionContent.tsx` now owns:
  - section-router-level lazy composition
  - async fallback presentation for router-owned panel loading
- The page and underlying heavy sections still own:
  - all real write-path execution
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)`
  - config/file fetch and mutation behavior
  - truth-source routing and readonly/writable decisions

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1444`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `232`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`
- Fresh build output now shows:
  - `dist/assets/InstanceDetail-CO9QGjPk.js`: `179.55 kB`
  - `dist/assets/InstanceConfigWorkbenchPanel-BoVtLBcy.js`: `63.33 kB`
  - `dist/assets/InstanceDetailFilesSection-BEBOjm48.js`: `2.38 kB`
- Relative to the prior `InstanceDetail` chunk baseline of about `262.56 kB`, this loop materially reduces first-open route cost while keeping `CP07-3` open.

## Verification

- RED before implementation:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the section router still eagerly imported the heavy `files` and `config` panels
- GREEN after implementation and fresh re-run:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchHydration.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes one concrete performance and modularity defect, but it does not yet close the remaining page hotspot in `InstanceDetail.tsx`.

## Next Frontier

- Return to the Step 07 priority order from the benchmark audit:
  - keep clearing page-side pure projection/reset bundles in `InstanceDetail.tsx`
  - only add more lazy splits where the router boundary stays clean
- Preserve the same rule:
  - shared read-side shaping may move out
  - truth-source routing, write authority, `toast`, and reload authority stay where they already belong
