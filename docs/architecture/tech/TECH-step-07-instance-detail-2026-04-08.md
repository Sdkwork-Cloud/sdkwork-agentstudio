> Migrated from `docs/review/step-07-instance-detail分区一致性-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Section Decomposition Consistency - 2026-04-08

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - continue shrinking `InstanceDetail.tsx` without changing OpenClaw truth-source behavior
  - keep reducing the two remaining service-core hotspots without changing OpenClaw truth-source behavior
  - move remote provider patch construction out of `instanceServiceCore.ts`
  - move duplicated fallback config-path resolution out of both service cores into one shared helper
  - move OpenClaw file path normalization and request-path derivation out of `instanceWorkbenchServiceCore.ts`
  - keep page-owned side effects and write-path invocation intact
  - refresh the real hotspot frontier before choosing the next `CP07-3` slice

## Implemented Decomposition

- Extracted shared row-shell primitives:
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceWorkbenchPrimitives.tsx`
- Extracted dedicated Instance Detail render components:
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailOverviewSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailFilesSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailChannelsSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSkillsSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailMemorySection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailToolsSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailLlmProvidersSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailLlmProviderDialogs.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebSearchNativeCodexPanel.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedXSearchPanel.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedAuthCooldownsPanel.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailAgentsSection.tsx`
- Extracted pure helper layers:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`
- Added focused helper coverage:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- Updated orchestration and component/service barrels:
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/components/index.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- Extended the contract suite so the render-composition boundary stays enforced:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `InstanceDetail.tsx` remains the page-level orchestrator for:
  - active section routing
  - OpenClaw truth-source loading
  - write-path callback wiring
  - section availability decisions
  - provider and agent dialog state, managed config draft state, and destructive confirmation ids
  - page-owned side effects such as `toast`, `setIsSaving*`, `set*Error`, and `loadWorkbench`
- Extracted components own the render surfaces for:
  - `overview`
  - `files`
  - `channels`
  - `skills`
  - `memory`
  - `tools`
  - `llmProviders`
  - `llmProviders dialogs`
  - `llmProviders composition wrapper`
  - `managed webSearch`
  - `managed webFetch`
  - `managed webSearch native codex`
  - `managed xSearch`
  - `managed auth cooldowns`
  - `agents`
- `InstanceDetailManagedLlmProvidersSection.tsx` now owns the combined provider section/dialog composition and the dialog dismiss-reset bridging, while the page still owns submit/delete callbacks and all OpenClaw write-path invocation.
- `InstanceDetailManagedMemorySection.tsx` now owns the memory loading shell plus the empty-state handoff, so the page no longer composes those guards inline.
- `InstanceDetailManagedToolsSection.tsx` now owns the tools empty-state and runtime-surface aggregation guard, so the page no longer computes the tools shell visibility inline.
- The page no longer keeps dedicated `renderManagedWebSearchPanel`, `renderManagedWebFetchPanel`, `renderManagedWebSearchNativeCodexPanel`, `renderManagedXSearchPanel`, or `renderManagedAuthCooldownsPanel` wrapper functions; those managed surfaces are now prebuilt as JSX values and passed straight into `toolsSectionProps`.
- `openClawProviderDrafts.ts` now also owns provider and provider-model mutation-plan construction, so the page no longer derives provider submit metadata inline before dispatching the actual write-path calls.
- `openClawProviderDrafts.ts` now also owns the provider dialog form-state types and draft factory helpers, so `InstanceDetail.tsx` no longer defines those pure shapes inline.
- `openClawProviderConfigPatch.ts` now owns remote OpenClaw provider request-override patch construction, runtime params patch construction, and the final remote provider config patch payload shape, so `instanceServiceCore.ts` no longer keeps that provider-specific pure patch logic inline.
- `openClawConfigPathFallback.ts` now owns fallback managed-config path resolution shared by `instanceServiceCore.ts` and `instanceWorkbenchServiceCore.ts`, so the same route/artifact precedence logic is no longer duplicated across both cores.
- `openClawFilePathSupport.ts` now owns OpenClaw file path normalization, workspace-prefix trimming, basename derivation, and final request-path derivation, so `instanceWorkbenchServiceCore.ts` no longer keeps that path-specific pure helper cluster inline.
- `InstanceDetail.tsx` now routes managed webSearch/xSearch/webFetch/native codex/auth cooldowns/dreaming save side effects through a shared `runManagedConfigSave` runner, while still keeping the actual `instanceService` write-path invocation in the page.
- `InstanceDetail.tsx` now routes provider and provider-model success toasts, dialog dismiss/reset, workbench reload, and provider reselection through a shared `completeProviderCatalogMutation` runner while keeping the real `instanceService` mutation call sites in the page.
- The page now prebuilds `agentSectionProps`, `llmProviderSectionProps`, and `llmProviderDialogProps`, so render functions stay thin without moving truth ownership away from the page.
- Shared row chrome remains centralized in `InstanceWorkbenchPrimitives.tsx`.
- Pure formatting and provider draft parsing still live outside the page:
  - `instanceWorkbenchFormatting.ts` owns workbench label humanization.
  - `openClawManagedConfigDrafts.ts` owns managed webSearch, xSearch, native codex, webFetch, and auth cooldown save-input construction.
  - `openClawProviderDrafts.ts` owns provider dialog form-state types, provider draft factories, provider-create dialog validation, provider-model dialog validation, request-override parsing, provider model text parsing, default-model fallback, and provider input construction.
- Service-core patch and path helpers now also live outside the cores:
  - `openClawProviderConfigPatch.ts` owns remote provider request patch normalization and final provider patch payload construction.
  - `openClawConfigPathFallback.ts` owns config route vs artifact fallback precedence.
  - `openClawFilePathSupport.ts` owns OpenClaw file path normalization, case-insensitive Windows/share prefix comparison, and request-path derivation.
- The page intentionally keeps OpenClaw write-path invocation and post-save side effects in place, so Gateway / Hosted Studio / Config Service routing semantics stay unchanged.

## Evidence

- `InstanceDetail.tsx` line count before this decomposition stream: `5328`
- Previously verified measurement after the `overview + files + channels + skills + memory + tools` extraction: `4564`
- Previously verified measurement after the `llmProviders + provider dialogs` extraction: `4414`
- Previously verified measurement after the `managed webSearch + managed webFetch` extraction: `4046`
- Previously verified measurement after the `managed webSearch native codex + managed xSearch + managed auth cooldowns` extraction: `3590`
- Previously verified measurement after the `agents` extraction: `3290`
- Previously verified measurement after the cron-task cleanup: `3142`
- Previously verified measurement after the managed-config and provider-dialog helper extraction: `2702`
- Previously verified measurement after the provider model parser/formatter helper extraction: `2635`
- Fresh current-worktree measurement after the managed llmProviders composition extraction and render-prop consolidation: `2618`
- Previously verified measurement after the managed memory/tools wrapper extraction: `2596`
- Fresh current-worktree measurement after removing the remaining page-level memory/tools and managed panel wrapper functions: `2575`
- Fresh current-worktree measurement before the latest provider draft-factory extraction and shared provider success runner: `2811`
- Fresh current-worktree measurement after the latest provider draft-factory extraction and shared provider success runner: `2792`
- Fresh current-worktree measurement after extracting remote provider patch helpers out of `instanceServiceCore.ts`: `instanceServiceCore.ts = 1452`
- Fresh current-worktree measurement after extracting shared fallback config-path resolution out of both service cores: `instanceServiceCore.ts = 1431`, `instanceWorkbenchServiceCore.ts = 3797`
- Fresh current-worktree measurement after extracting OpenClaw file path helpers out of `instanceWorkbenchServiceCore.ts`: `instanceWorkbenchServiceCore.ts = 3693`
- `renderAgentsSection` size before prop-bundle consolidation: `60`
- `renderAgentsSection` size after prop-bundle consolidation: `7`
- `renderOpenClawProviderDialogs` moved fully out of the page into `InstanceDetailManagedLlmProvidersSection.tsx`
- `renderManagedLlmProviderSection` moved fully out of the page into `InstanceDetailManagedLlmProvidersSection.tsx`
- `renderLlmProvidersSection` current size after the composition handoff: `18`
- `renderMemorySection` is fully removed from the page and replaced with `memorySectionContent`
- `renderToolsSection` is fully removed from the page and replaced with `toolsSectionContent`
- `renderManagedWebSearchPanel` is fully removed from the page and replaced with `managedWebSearchPanel`
- `renderManagedWebFetchPanel` is fully removed from the page and replaced with `managedWebFetchPanel`
- `renderManagedWebSearchNativeCodexPanel` is fully removed from the page and replaced with `managedWebSearchNativeCodexPanel`
- `renderManagedXSearchPanel` is fully removed from the page and replaced with `managedXSearchPanel`
- `renderManagedAuthCooldownsPanel` is fully removed from the page and replaced with `managedAuthCooldownsPanel`
- Provider and provider-model submit handlers now consume `buildOpenClawProviderDialogMutationPlan` and `buildOpenClawProviderModelMutationPlan` from `openClawProviderDrafts.ts`
- Provider dialog state types and draft factories now come from `openClawProviderDrafts.ts` instead of local page definitions
- Managed config save handlers now consume the shared `runManagedConfigSave` page runner instead of each keeping duplicated saving/error/reload shells
- Provider and provider-model success paths now share `completeProviderCatalogMutation` inside the page
- Remote provider config patch construction is removed from `instanceServiceCore.ts` and owned by `openClawProviderConfigPatch.ts`
- Fallback config-path resolution is removed from both core files and owned by `openClawConfigPathFallback.ts`
- OpenClaw file path normalization and request-path derivation are removed from `instanceWorkbenchServiceCore.ts` and owned by `openClawFilePathSupport.ts`
- Fresh current hotspots still blocking formal closure:
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2792`
  - `handleSubmitProviderModelDialog` inside `InstanceDetail.tsx`
  - `handleSubmitProviderDialog` inside `InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `3693`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

## OpenClaw Alignment Guardrails

This loop kept the Step 07 truth-source boundary unchanged and continued to treat the following files as the authority set for closure claims:

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

Facts re-read in this loop:

- `webStudio.test.ts` still asserts that browser-backed Instance Detail persistence carries current-session provider edits and managed channel writes through the workbench detail, so the composition extraction could not move or reinterpret provider write-path ownership.
- `instanceService.test.ts` still asserts that built-in managed and config-backed OpenClaw provider creation and provider-model creation remain rejected in favor of Provider Center, so the new composition layer remains render-only and does not change authority routing.
- `openClawManagementCapabilities.ts` still derives Provider Center managed OpenClaw state from `workbenchManaged` or writable managed config routes.
- `openClawProviderWorkspacePresentation.ts` still turns that managed-state classification into `isProviderConfigReadonly` and `canManageProviderCatalog` decisions.
- `openClawConfigSchemaSupport.test.ts` still asserts that `deriveVisibleSchemaSections` preserves the Control UI section order, so the managed tools/config surfaces remain aligned with the expected schema presentation order.
- `channelService.ts` still routes managed channel mutations through `openClawConfigService` or the studio bridge; no channel write path was altered by the page decomposition.
- `marketService.ts` still owns skill/package discovery and install entry points, so Instance Detail did not absorb marketplace responsibilities.
- `agentInstallService.ts` still resolves workspace and agent paths from the OpenClaw config snapshot before installing templates, so agent workspace materialization stays outside the page.
- `local_ai_proxy.rs` still owns the OpenAI-compatible, Anthropic, Gemini, and Ollama route projection plus `/v1/chat/completions` and `/v1/responses` handling.
- `plugins/mod.rs` still only registers the desktop dialog, notification, opener, and single-instance plugins; the workbench decomposition did not change desktop bootstrap/plugin registration.
- This loop only moved pure helper logic. `instanceServiceCore.ts` and `instanceWorkbenchServiceCore.ts` still own the same authority checks, studio bridge calls, gateway calls, and fallback routing decisions as before.

## Verification

- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`

All commands passed on fresh execution in this loop.

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open, but materially advanced
- `CP07-4`: still pending final closure writeback

`Step 07` remains `in progress / not closed`. The current worktree page hotspot remains at `2792` lines, but this loop materially reduced the service-core frontier: `instanceServiceCore.ts` dropped from `1663` to `1431`, and `instanceWorkbenchServiceCore.ts` dropped from `3818` to `3693` after the shared config-path and file-path helper extractions. Provider submit orchestration in the page still keeps `CP07-3` open, and `instanceWorkbenchServiceCore.ts` remains the largest unresolved hotspot.

## Next Frontier

- Continue shrinking the remaining `InstanceDetail.tsx` orchestration hotspots, prioritizing:
  - `handleSubmitProviderModelDialog`
  - `handleSubmitProviderDialog`
- Continue decomposing `instanceWorkbenchServiceCore.ts`, prioritizing the next pure helper cluster around task normalization utilities.
- Re-check whether `instanceServiceCore.ts` still contains another pure helper cluster worth extracting after the provider patch and config-path gains.

## Latest Loop Addendum

- Extracted shared task normalization ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`
- Added focused task normalization coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- Extracted shared runtime memory summarization ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`
- Added focused runtime memory coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the agents-market contract reflects the current:
  - `InstanceDetail.tsx -> InstanceDetailAgentsSection.tsx -> AgentWorkbenchPanel.tsx`
- The same contract suite now also guards both new helper boundaries so task normalization and runtime memory summarization do not drift back into `instanceWorkbenchServiceCore.ts`.
- This loop still kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source selection.
  - only pure task and runtime-memory shaping logic moved.

### Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2924`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`

### Fresh Verification

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution after the latest helper extraction and contract realignment.

### Channel And Agent Helper Extraction

- Extracted shared channel workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`
- Extracted shared agent workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`
- Added focused coverage for both new helpers in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so channel mapping/clone/merge and agent mapping/clone/normalize/merge/build-managed logic no longer live inline in the core hotspot.
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so the new helper boundaries are exported through the service barrel.
- Fixed a real agent deduplication defect inside `openClawAgentWorkbenchSupport.ts` by normalizing managed snapshot ids before runtime overlay, which prevents malformed managed ids from appending duplicate runtime agents.
- Realigned `scripts/sdkwork-instances-contract.test.ts` so the managed-agent `configSource: 'managedConfig'` evidence is asserted from `openClawAgentWorkbenchSupport.ts`, while the core contract still proves `managedConfigSnapshot?.agentSnapshots` routing remains in `instanceWorkbenchServiceCore.ts`.

### Fresh Measurements After Channel And Agent Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2635`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- Relative to the previously verified `2924`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced by another `289` lines without changing gateway, studio, or backend authority routing.

### Fresh Verification After Channel And Agent Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the channel and agent helper boundaries and repaired the stale contract evidence path.

### Updated Frontier

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2635` lines.
- The next decomposition frontier should move to the remaining managed-config clone and provider/workbench snapshot shaping helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch in `InstanceDetail.tsx`.

### Managed Config Workbench Helper Extraction

- Extracted shared managed OpenClaw workbench config shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so the following pure logic no longer lives inline in the service-core hotspot:
  - empty managed config snapshot construction
  - managed config section-count derivation
  - managed config insights derivation
  - managed webSearch / xSearch / native codex / webFetch / auth cooldowns / dreaming deep-clone logic
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so the new managed-config helper boundary is exported through the service barrel.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract suite now guards this helper boundary and prevents the removed managed-config shaping functions from drifting back into `instanceWorkbenchServiceCore.ts`.
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing.
  - only managed-config snapshot shaping and cloning logic moved.

### Fresh Measurements After Managed Config Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2462`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`: `207`
- Relative to the previously verified `2635`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced by another `173` lines without changing gateway, studio, or backend authority routing.

### Fresh Verification After Managed Config Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the managed-config workbench helper boundary.

### Updated Frontier II

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2462` lines.
- The next decomposition frontier should move to the remaining provider/workbench snapshot shaping helpers inside `instanceWorkbenchServiceCore.ts`, especially the managed-provider mapping and live-provider composition cluster, while keeping page-owned write-path dispatch in `InstanceDetail.tsx`.

### Updated Frontier

- `CP07-3` remains open.
- The largest unresolved hotspot in the active Step 07 slice is now:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2924` lines
- The next pure-core extraction candidates are now the channel and agent normalization/merge clusters near:
  - `mergeOpenClawChannelCollections`
  - `normalizeWorkbenchAgent`
  - `mergeOpenClawAgentCollections`
- `InstanceDetail.tsx` at `2553` lines remains the secondary Step 07 hotspot, with provider submit orchestration still pending later closure work.

### Provider Workbench Helper Extraction

- Extracted shared OpenClaw provider workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so the following pure provider shaping logic no longer lives inline in the service-core hotspot:
  - managed-provider snapshot mapping
  - live provider catalog mapping
  - provider id matching across snapshot/runtime sources
  - final OpenClaw provider composition for the workbench snapshot
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so the new provider helper boundary is exported through the service barrel.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract suite now guards this helper boundary and prevents the removed provider shaping helpers from drifting back into `instanceWorkbenchServiceCore.ts`.
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing.
  - only pure provider workbench shaping logic moved.

### Fresh Measurements After Provider Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2379`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`: `207`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`: `111`
- Relative to the prior `2462`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `2379` without changing gateway selection, studio bridge routing, backend truth-source precedence, or page-owned write-path authority.

### Fresh Verification After Provider Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the provider workbench helper boundary.

### Updated Frontier III

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2379` lines.
- The next decomposition frontier should move to the remaining skills/tool catalog shaping helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch and service-core truth-source routing unchanged.

### Skill And Tool Workbench Helper Extraction

- Extracted shared OpenClaw skill workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.ts`
- Extracted shared OpenClaw tool workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.ts`
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so the following pure shaping logic no longer lives inline in the service-core hotspot:
  - skill category inference
  - skill status-entry shaping
  - tool category inference
  - tool access inference
  - scoped tool catalog shaping
  - merged multi-agent tool catalog composition
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so both new helper boundaries are exported through the service barrel.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract suite now guards both helper boundaries and prevents the removed skill/tool shaping helpers from drifting back into `instanceWorkbenchServiceCore.ts`.
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing.
  - only pure skill and tool workbench shaping logic moved.

### Fresh Measurements After Skill And Tool Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2361`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`: `207`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`: `111`
- `packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.ts`: `55`
- `packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.ts`: `186`
- Relative to the prior `2379`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `2361` without changing gateway selection, studio bridge routing, backend truth-source precedence, or page-owned write-path authority.

### Fresh Verification After Skill And Tool Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the skill and tool workbench helper boundaries.

### Updated Frontier IV

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2361` lines.
- The next decomposition frontier should move to the remaining file/memory shaping or registry projection helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch and service-core truth-source routing unchanged.

### File Workbench Helper Extraction

- Extracted shared OpenClaw file workbench shaping ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawFileWorkbenchSupport.ts`
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawFileWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so the following pure file/memory shaping logic no longer lives inline in the service-core hotspot:
  - file category inference
  - file entry to workbench-file mapping
  - merged file collection overlay behavior
  - backend memory summary synthesis from file snapshots and qmd config
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so the new file helper boundary is exported through the service barrel.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract suite now guards the new file helper boundary and also proves that file path derivation still routes through `openClawFilePathSupport.ts`, now via `openClawFileWorkbenchSupport.ts`.
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing and async file-loading timing.
  - only pure file/memory shaping logic moved.

### Fresh Measurements After File Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `2192`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.ts`: `206`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`: `207`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`: `111`
- `packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.ts`: `55`
- `packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.ts`: `186`
- `packages/sdkwork-clawstudio-instances/src/services/openClawFileWorkbenchSupport.ts`: `188`
- Relative to the prior `2361`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `2192` without changing gateway selection, studio bridge routing, backend truth-source precedence, or page-owned write-path authority.

### Fresh Verification After File Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFileWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the file workbench helper boundary.

### Updated Frontier V

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `2192` lines.
- The next decomposition frontier should move to the remaining registry projection or section-availability shaping helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch and service-core truth-source routing unchanged.

### Registry Projection Helper Extraction

- Extracted shared registry-backed detail projection ownership into:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceRegistryWorkbenchSupport.ts`
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceRegistryWorkbenchSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` so the following pure registry-backed detail projection logic no longer lives inline in the service-core hotspot:
  - `buildRegistryBackedDetail`
  - `resolveRegistryRuntimeKind`
  - `resolveRegistryDeploymentMode`
  - `resolveRegistryTransportKind`
  - `resolveRegistryStorageBinding`
  - `storageCapabilitiesForProvider`
  - `resolveRegistryStorageStatus`
  - `resolveRegistryLifecycleOwner`
  - `defaultCapabilitiesForRuntime`
  - `buildRegistryConnectivityEndpoints`
  - `isLoopbackHost`
- Updated `packages/sdkwork-clawstudio-instances/src/services/index.ts` so the new helper boundary is exported through the service barrel.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract suite now guards the registry-backed detail helper boundary and prevents those projection helpers from drifting back into `instanceWorkbenchServiceCore.ts`.
- Fresh verification exposed one regression introduced during the extraction loop:
  - `buildOpenClawChannels(...)` still referenced `isNonEmptyString`
  - the import had disappeared from `instanceWorkbenchServiceCore.ts`
  - because gateway channel shaping is wrapped in `safelyBuildOpenClawSection(...)`, that missing import collapsed the live channel section to `[]` and made Slack fall back to the catalog default `not_configured`
  - restored the import before accepting the extraction so the runtime-backed channel snapshot stays truthful
- OpenClaw authority checkpoints were re-read and remain unchanged for this loop:
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch.
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing and fallback selection.
  - only pure registry-backed detail projection logic moved.

### Fresh Measurements After Registry Projection Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1675`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/instanceRegistryWorkbenchSupport.ts`: `365`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.ts`: `207`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.ts`: `216`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`: `111`
- `packages/sdkwork-clawstudio-instances/src/services/openClawSkillWorkbenchSupport.ts`: `55`
- `packages/sdkwork-clawstudio-instances/src/services/openClawToolWorkbenchSupport.ts`: `186`
- `packages/sdkwork-clawstudio-instances/src/services/openClawFileWorkbenchSupport.ts`: `188`
- Relative to the prior `2192`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `1675` without changing gateway selection, studio bridge routing, backend truth-source precedence, page-owned write-path authority, or OpenClaw provider-management boundaries.

### Fresh Verification After Registry Projection Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceRegistryWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that completed the registry projection helper boundary and repaired the swallowed channel-order regression.

### Updated Frontier VI

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `1675` lines.
- The next decomposition frontier should move to the remaining snapshot-assembly or section-availability helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch, provider-management truth, and service-core truth-source routing unchanged.

### Snapshot Assembly Helper Extraction

- `instanceWorkbenchSnapshotSupport.ts` now owns backend-authored OpenClaw workbench snapshot assembly and section-availability composition that previously lived inline in `instanceWorkbenchServiceCore.ts`, including:
  - `buildOpenClawChannelCatalog(...)`
  - `mapBackendWorkbench(...)`
  - `buildOpenClawSnapshotFromSections(...)`
  - `mergeOpenClawSnapshots(...)`
  - `finalizeOpenClawSnapshot(...)`
  - `buildDetailOnlyWorkbenchSnapshot(...)`
  - the supporting overview-count, capability-availability, and section-count derivation logic that those snapshot builders depend on
- `instanceWorkbenchServiceCore.ts` now consumes the snapshot helper for:
  - backend-authored workbench mapping
  - live gateway section snapshot assembly
  - managed-config overlay finalization
  - detail-only fallback workbench snapshot construction
- `packages/sdkwork-clawstudio-instances/src/services/index.ts` now exports the snapshot helper through the service barrel so the new boundary remains consumable from the package root.
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts` now provides focused helper coverage for:
  - detail-only snapshot counting and managed-config alignment
  - final managed-config overlay behavior across channels, providers, agents, and section availability
- `scripts/sdkwork-instances-contract.test.ts` now enforces the new helper boundary and also records one important routing fact explicitly:
  - channel workbench shaping still belongs to `openClawChannelWorkbenchSupport.ts`
  - but the routing path is now `instanceWorkbenchServiceCore.ts -> instanceWorkbenchSnapshotSupport.ts -> openClawChannelWorkbenchSupport.ts`
- Fresh verification in this loop exposed stale test evidence, not a runtime regression:
  - the new detail-only helper fixture contributes `8` overview entries, not `7`
  - the contract suite still expected `dataAccess`, managed-agent overlay evidence, and direct channel-helper imports to stay in `instanceWorkbenchServiceCore.ts`
  - those assertions were updated to follow the new snapshot-helper boundary before accepting the extraction
- OpenClaw authority checkpoints were re-read again for this loop and remain unchanged:
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
- This loop kept OpenClaw authority unchanged:
  - `InstanceDetail.tsx` still owns page-level side effects and write-path dispatch
  - `instanceWorkbenchServiceCore.ts` still owns gateway/studio/backend truth-source routing and lazy runtime section loading
  - only pure snapshot assembly and section-availability composition moved

### Fresh Measurements After Snapshot Assembly Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1209`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchSnapshotSupport.ts`: `498`
- Relative to the prior `1675`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `1209` without changing gateway selection, studio bridge routing, backend truth-source precedence, page-owned write-path authority, provider-management classification, or OpenClaw channel truth.

### Fresh Verification After Snapshot Assembly Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that completed the snapshot assembly helper boundary and realigned the stale contract evidence to the new routing path.

### Updated Frontier VII

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `1209` lines.
- The next decomposition frontier should move to the remaining gateway-backed channel/status shaping and runtime section-loader helpers inside `instanceWorkbenchServiceCore.ts`, while keeping page-owned write-path dispatch, provider-management truth, and service-core truth-source routing unchanged.

### Channel Runtime Helper Extraction

- `openClawChannelWorkbenchSupport.ts` now owns the full OpenClaw channel workbench shaping stack, including:
  - configured-value inference for gateway channel fields
  - channel connection-status normalization
  - account-state presentation text
  - gateway account overlay shaping
  - final `buildOpenClawChannels(...)` runtime channel snapshot assembly
- `instanceWorkbenchServiceCore.ts` now consumes `buildOpenClawChannels(...)` from the helper instead of keeping the following pure channel-shaping functions inline:
  - `isConfiguredValue`
  - `normalizeChannelConnectionStatus`
  - `formatChannelAccountState`
  - `buildOpenClawChannelAccounts`
  - `buildOpenClawChannels`
- This loop intentionally kept the authority split unchanged:
  - `instanceWorkbenchServiceCore.ts` still owns whether the gateway is probed, when the channel status call runs, and how failures are swallowed through `safelyBuildOpenClawSection(...)`
  - `openClawChannelWorkbenchSupport.ts` now owns only the pure shaping of the returned channel payload
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts` now verifies:
  - the helper exports `buildOpenClawChannels(...)`
  - runtime channel order stays aligned with `channelOrder`
  - account detail and naming survive the helper extraction
  - `sdkworkchat` keeps its configuration-free runtime semantics
- `scripts/sdkwork-instances-contract.test.ts` now enforces that the channel runtime shaping helpers no longer drift back into `instanceWorkbenchServiceCore.ts`.
- Fresh red/green verification for this loop was explicit:
  - helper test failed first because `buildOpenClawChannels(...)` was missing from the helper export surface
  - contract test failed first because the old channel-shaping functions still lived inline in `instanceWorkbenchServiceCore.ts`
  - only after those failures were observed did the helper extraction land
- OpenClaw authority checkpoints remained unchanged in this loop:
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

### Fresh Measurements After Channel Runtime Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2553`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1030`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- `packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.ts`: `290`
- Relative to the prior `1209`-line service-core baseline, `instanceWorkbenchServiceCore.ts` is now reduced to `1030` without changing gateway selection, studio bridge routing, backend truth-source precedence, page-owned write-path authority, provider-management classification, or OpenClaw channel truth.

### Fresh Verification After Channel Runtime Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that completed the channel runtime helper boundary.

### Updated Frontier VIII

- `CP07-3` remains open.
- The page hotspot remains `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` at `2553` lines.
- The largest remaining service hotspot is now `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` at `1030` lines.
- The next decomposition frontier should pivot back to the page-level provider submit orchestration inside `InstanceDetail.tsx`, because the service-core hotspot has now been materially reduced below the still-open page hotspot.

### Provider Submit Runner Extraction

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts` now tags page-facing provider submit plans with explicit action kinds:
  - `providerCreate`
  - `providerModelCreate`
  - `providerModelUpdate`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now routes both provider submit handlers through a shared page-owned `runProviderCatalogMutation(...)` runner instead of duplicating save, error, and post-success orchestration in each handler.
- This loop intentionally kept write-path authority in the page:
  - `instanceService.createInstanceLlmProvider(...)`
  - `instanceService.createInstanceLlmProviderModel(...)`
  - `instanceService.updateInstanceLlmProviderModel(...)`
  - `toast.*`
  - `loadWorkbench(...)`
  - provider dialog dismiss/reset state
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts` now enforces the new action-kind metadata for the page shell.
- `scripts/sdkwork-instances-contract.test.ts` now enforces that:
  - `InstanceDetail.tsx` owns a shared `runProviderCatalogMutation(...)` runner
  - both submit handlers route through that runner
  - provider create / provider-model create / provider-model update still remain page-owned write-path calls
- Fresh red/green verification in this loop was explicit:
  - `openClawProviderDrafts.test.ts` failed first because provider mutation plans did not yet include `kind`
  - `scripts/sdkwork-instances-contract.test.ts` failed first because the page did not yet expose `runProviderCatalogMutation(...)`
  - only after those failures were observed did the action-kind metadata and shared page runner land

### OpenClaw Authority Checkpoints Re-read In This Loop

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts` still proves browser-backed workbench detail preserves provider edits after save.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts` still derives managed OpenClaw authority from `workbenchManaged` or writable managed config routes.
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts` still keeps `canManageProviderCatalog: false` for OpenClaw details.
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts` still preserves Control UI section order.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts` still owns managed channel writes through config service or studio bridge.
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts` still owns skill/package discovery and install entry points.
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts` still resolves agent install/workspace plans from OpenClaw config-backed paths.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still owns the local proxy `chat/completions`, `responses`, Anthropic, Gemini, and Ollama protocol surface.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs` still only registers desktop plugin bootstrap.

### Fresh Measurements After Provider Submit Runner Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2803`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `345`
- The current worktree no longer matches the older `2553 / 1030 / 1274` hotspot snapshot recorded in the prior addendum, so further `CP07-3` loops should use the fresh `2803 / 1132 / 1431` profile as the active baseline.
- This loop removed duplicated provider submit orchestration, but it does not yet close the page hotspot by raw line count.

### Fresh Verification After Provider Submit Runner Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the provider submit action-kind metadata and shared page runner boundary.

### Updated Frontier IX

- `CP07-3` remains open.
- The page hotspot is still the dominant frontier at `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` with a fresh current-worktree measurement of `2803` lines.
- The next decomposition frontier should stay in the page-level provider workspace cluster, prioritizing the remaining provider config save/delete flows around:
  - `handleSaveProviderConfig`
  - `handleDeleteProviderModel`
  - `handleDeleteProvider`
- `instanceWorkbenchServiceCore.ts` remains a secondary hotspot at `1132` lines, but the next best move is still the page because the provider workspace mutation lifecycle remains the densest page-owned orchestration cluster.

### Provider Delete Runner Expansion

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts` now also owns page-facing delete mutation metadata for:
  - `providerModelDelete`
  - `providerDelete`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now routes the following flows through the same page-owned `runProviderCatalogMutation(...)` runner:
  - provider create
  - provider-model create
  - provider-model update
  - provider-model delete
  - provider delete
- `completeProviderCatalogMutation(...)` now applies shared page-owned success handling for all five provider catalog mutations:
  - success toast dispatch
  - optional local cleanup callback
  - `loadWorkbench(..., { withSpinner: false })`
  - provider reselection / deselection
- This loop still keeps all authority-bearing operations in the page:
  - `instanceService.createInstanceLlmProvider(...)`
  - `instanceService.createInstanceLlmProviderModel(...)`
  - `instanceService.updateInstanceLlmProviderModel(...)`
  - `instanceService.deleteInstanceLlmProviderModel(...)`
  - `instanceService.deleteInstanceLlmProvider(...)`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts` now verifies the new delete mutation metadata.
- `scripts/sdkwork-instances-contract.test.ts` now proves the delete handlers also route through `runProviderCatalogMutation(...)` and no longer duplicate local `toast.success(...)` or `loadWorkbench(...)` calls inline.
- Fresh red/green verification in this loop was explicit:
  - `openClawProviderDrafts.test.ts` failed first because delete mutation builders were not yet exported
  - `scripts/sdkwork-instances-contract.test.ts` failed first because the delete handlers still mutated the page inline
  - only after those failures were observed did the delete mutation metadata and runner expansion land

### Fresh Measurements After Provider Delete Runner Expansion

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2816`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `396`
- Relative to the immediately prior `2803` page baseline in this same worktree, the page hotspot is still not shrinking by raw line count, but the provider catalog mutation lifecycle is now more coherent and contract-guarded.

### Fresh Verification After Provider Delete Runner Expansion

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that expanded the shared provider catalog runner to the delete flows.

### Updated Frontier X

- `CP07-3` remains open.
- The next decomposition frontier should stay inside the page-level provider workspace cluster, now focusing on the remaining provider config update flow:
  - `handleSaveProviderConfig`
- The create/update/delete provider catalog lifecycle is now routed through one page-owned runner, so the next best extraction target is the last standalone provider config save path rather than another service-core slice.

### Provider Config Save Runner Integration

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts` now owns:
  - `buildOpenClawProviderConfigSaveInput(...)`
  - `buildOpenClawProviderConfigMutationPlan(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now routes `handleSaveProviderConfig` through the same page-owned `runProviderCatalogMutation(...)` runner as the other provider catalog mutations.
- This loop preserved the existing page authority split:
  - `instanceService.updateInstanceLlmProviderConfig(...)` still executes in the page runner
  - request-override parse failures still surface through page-owned `toast.error(...)`
  - provider config save still reloads the workbench with spinner enabled
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts` now verifies the provider config save-input and mutation-plan boundary.
- `scripts/sdkwork-instances-contract.test.ts` now enforces that `handleSaveProviderConfig` no longer performs inline request-override parsing or direct config-write orchestration.
- Fresh red/green verification in this loop was explicit:
  - the helper test failed first because provider config save builders were missing
  - the contract test failed first because `handleSaveProviderConfig` still parsed overrides and saved inline
  - only after those failures were observed did the helper boundary and runner integration land

### Fresh Measurements After Provider Config Save Runner Integration

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2827`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `461`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- This loop improved provider mutation-path consistency, but page line count still did not move down yet.

### Fresh Verification After Provider Config Save Runner Integration

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that moved provider config save into the shared page runner.

### Provider Draft Baseline Extraction

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts` now also owns pure provider draft derivation helpers:
  - `createOpenClawProviderConfigDraft(...)`
  - `createOpenClawProviderRequestDraft(...)`
  - `hasPendingOpenClawProviderConfigChanges(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now consumes those helpers for:
  - selected provider draft fallback state
  - selected provider request baseline derivation
  - pending-change detection
  - provider draft reset behavior
- This loop intentionally stayed in pure draft-state shaping only. No provider write authority, gateway routing, Provider Center managed classification, or Local Proxy / plugin runtime boundary changed.
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts` now verifies cloned baseline behavior, request baseline derivation, and pending-change detection.
- `scripts/sdkwork-instances-contract.test.ts` now proves the page uses the new helper boundary instead of keeping the provider baseline object literals inline.

### Fresh Measurements After Provider Draft Baseline Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2810`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `510`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Relative to the immediately prior `2827` page baseline, this loop reduced the page hotspot to `2810` while consolidating more provider draft logic into the shared helper layer.

### Fresh Verification After Provider Draft Baseline Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that moved provider draft baseline and dirty-state derivation out of the page.

### Updated Frontier XI

- `CP07-3` remains open.
- The provider catalog write lifecycle is now on one page-owned runner and provider draft baselines are centralized in shared helpers.
- The next decomposition frontier should stay in the same page cluster, prioritizing the remaining pure draft mutation helpers:
  - `handleProviderFieldChange`
  - `handleProviderConfigChange`
  - `handleProviderRequestOverridesChange`
- `instanceWorkbenchServiceCore.ts` remains stable at `1132` and is no longer the best immediate next slice while the page hotspot still dominates at `2810`.

### Provider Draft Mutation Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts` now also owns pure page-facing draft-map mutation helpers:
  - `applyOpenClawProviderFieldDraftChange(...)`
  - `applyOpenClawProviderConfigDraftChange(...)`
  - `applyOpenClawProviderRequestDraftChange(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now consumes those helpers for:
  - `handleProviderFieldChange`
  - `handleProviderConfigChange`
  - `handleProviderRequestOverridesChange`
- This loop intentionally kept the page authority split unchanged:
  - `InstanceDetail.tsx` still owns the readonly and selected-provider guards
  - `InstanceDetail.tsx` still owns the actual `setProviderDrafts(...)` and `setProviderRequestDrafts(...)` entry points
  - no `instanceService.*`, `toast.*`, `loadWorkbench(...)`, Provider Center managed classification, Local Proxy routing, or desktop plugin/runtime boundary moved
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts` now verifies that field/config/request draft updates clone the page-owned draft maps and preserve the existing optional-model clearing behavior.
- `scripts/sdkwork-instances-contract.test.ts` now proves that the page no longer keeps inline `nextDraft`, inline config-object reconstruction, or inline request-draft object literals inside those three handlers.
- Fresh red/green verification in this loop was explicit:
  - `openClawProviderDrafts.test.ts` failed first because the new helper exports were missing
  - `scripts/sdkwork-instances-contract.test.ts` failed first because the page still kept inline provider draft update logic
  - only after those failures were observed did the helper exports and page rewiring land

### OpenClaw Authority Checkpoints Re-read In This Loop

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts` still proves browser-backed workbench detail persists provider edits.
- `packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts` still rejects config-backed and built-in managed OpenClaw provider catalog writes outside Provider Center.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts` and `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts` still keep managed-provider authority and read-only classification outside the page.
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts` still preserves Control UI section order.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`, `packages/sdkwork-clawstudio-market/src/services/marketService.ts`, and `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts` remain the external feature owners for channel writes, market installs, and agent workspace materialization.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` and `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs` remain the Local Proxy and desktop plugin/runtime boundary.

### Fresh Measurements After Provider Draft Mutation Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2811`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `561`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Relative to the immediately prior `2810` page baseline, the page hotspot is effectively flat at `2811`. The gain in this loop is boundary tightening and stronger contract coverage, not raw line-count reduction.

### Fresh Verification After Provider Draft Mutation Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the provider draft mutation helper boundary.

### Updated Frontier XII

- `CP07-3` remains open.
- The remaining page frontier should stay inside the same provider workspace cluster, now re-evaluating the next high-yield slice around:
  - `handleResetProviderDraft`
  - provider dialog / provider-model dialog dismiss-reset lifecycle helpers
- `instanceWorkbenchServiceCore.ts` remains stable at `1132`, so the next best move is still page-side decomposition rather than another service-core pivot.

### Instance Detail Workbench Presentation Module Extraction

- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts` now owns the pure page-facing workbench presentation layer for:
  - `workbenchSections`
  - `getRuntimeStatusTone(...)`
  - `getStatusBadge(...)`
  - `getDangerBadge(...)`
  - `buildTaskScheduleSummary(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now imports that dedicated presentation module instead of keeping the section metadata, badge-tone mapping, and task schedule summary formatting inline.
- This loop intentionally kept the authority split unchanged:
  - `InstanceDetail.tsx` still owns workbench loading, truth-source routing, section selection, write-path invocation, and page-owned side effects
  - the new presentation module owns only pure metadata and formatting helpers
  - no `instanceService.*`, `toast.*`, `loadWorkbench(...)`, Provider Center managed classification, Local Proxy routing, or desktop plugin/runtime boundary moved
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts` now verifies:
  - section order and i18n-key stability
  - runtime/status/danger badge tone mapping
  - interval/datetime/fallback task schedule summary formatting
- `scripts/sdkwork-instances-contract.test.ts` now proves that:
  - the page imports the dedicated presentation module
  - `workbenchSections` and the related helper functions no longer drift back into the page
  - older icon- and sidebar-related assertions remain valid through the new boundary
- Fresh red/green verification in this loop was explicit:
  - the presentation helper test failed first because the new module did not exist
  - the contract test failed first because the page still kept the section metadata and helper definitions inline
  - a second contract red exposed stale assumptions that `BriefcaseBusiness` and sidebar keys had to stay in the page, and the contract was corrected to match the new dedicated presentation boundary before closure claims were updated

### OpenClaw Authority Checkpoints Re-read In This Loop

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts` still proves browser-backed workbench detail persists provider edits and managed channel writes.
- `packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts` still keeps Provider Center authority and remote OpenClaw provider routing outside the presentation layer.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts` and `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts` still keep managed-provider authority and read-only classification outside the page presentation module.
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts` still preserves Control UI section order.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`, `packages/sdkwork-clawstudio-market/src/services/marketService.ts`, and `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts` remain the external feature owners for channel writes, market installs, and agent workspace materialization.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` and `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs` remain the Local Proxy and desktop plugin/runtime boundary.

### Fresh Measurements After Instance Detail Workbench Presentation Module Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2640`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `183`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `561`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Relative to the immediately prior `2811` page baseline, this loop reduces the page hotspot to `2640` while keeping the new presentation-only code isolated in a dedicated module.

### Fresh Verification After Instance Detail Workbench Presentation Module Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the dedicated workbench presentation module.

### Updated Frontier XIII

- `CP07-3` remains open.
- The next high-yield page-side frontier should pivot to the remaining pure form-state factories and helper utilities near the top of `InstanceDetail.tsx`, prioritizing:
  - `createWebSearchSharedFormState`
  - `createWebSearchProviderFormState`
  - `createXSearchFormState`
  - `createWebSearchNativeCodexFormState`
  - `createWebFetchSharedFormState`
  - `createWebFetchFallbackFormState`
  - `createAuthCooldownsFormState`
- `instanceWorkbenchServiceCore.ts` remains stable at `1132`, so the best next move is still another page-side pure-helper extraction rather than a service-core pivot.

### Managed Config Draft Factory Extraction

- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts` now also owns the pure managed-config form-state factory layer for:
  - `createOpenClawWebSearchSharedDraft(...)`
  - `createOpenClawWebSearchProviderDraft(...)`
  - `createOpenClawXSearchDraft(...)`
  - `createOpenClawWebSearchNativeCodexDraft(...)`
  - `createOpenClawWebFetchSharedDraft(...)`
  - `createOpenClawWebFetchFallbackDraft(...)`
  - `createOpenClawAuthCooldownsDraft(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now consumes those helpers and their shared draft-value types through import aliases instead of keeping:
  - local managed-config form-state interfaces
  - local managed-config snapshot-to-draft mapping functions
  - local optional whole-number formatting logic
- This loop intentionally kept the page authority split unchanged:
  - `InstanceDetail.tsx` still owns `useState(...)`, `useEffect(...)`, save handlers, truth-source routing, and all write-path side effects
  - `openClawManagedConfigDrafts.ts` owns only pure draft shaping and save-input construction
  - no `instanceService.*`, `toast.*`, `loadWorkbench(...)`, Provider Center managed classification, Local Proxy routing, or desktop plugin/runtime boundary moved
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts` now verifies:
  - snapshot-to-draft mapping for webSearch, xSearch, native codex, webFetch, and auth cooldowns
  - empty fallback defaults for provider/fallback drafts
  - null passthrough for absent managed-config snapshots
- `scripts/sdkwork-instances-contract.test.ts` now proves that:
  - the page imports the managed-config draft factories and draft-value types from the shared helper
  - the local form-state interfaces, factory functions, and `formatOptionalWholeNumber(...)` no longer drift back into the page
- Fresh red/green verification in this loop was explicit:
  - `openClawManagedConfigDrafts.test.ts` failed first because the new factory exports were missing
  - `scripts/sdkwork-instances-contract.test.ts` failed first because the page still kept local types and factory functions inline
  - only after those failures were observed did the helper exports and page rewiring land

### OpenClaw Authority Checkpoints Re-read In This Loop

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts` still proves browser-backed workbench detail persists provider edits and managed channel writes.
- `packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts` still keeps Provider Center authority, managed config writes, and remote OpenClaw provider routing outside the new draft-factory layer.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts` and `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts` still keep managed-provider authority and read-only classification outside the page.
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts` still preserves Control UI section order.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`, `packages/sdkwork-clawstudio-market/src/services/marketService.ts`, and `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts` remain the external feature owners for channel writes, market installs, and agent workspace materialization.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` and `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs` remain the Local Proxy and desktop plugin/runtime boundary.

### Fresh Measurements After Managed Config Draft Factory Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2474`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `183`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `506`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `561`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1132`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Relative to the immediately prior `2640` page baseline, this loop reduces the page hotspot to `2474` while keeping the managed-config draft logic in one shared helper layer.

### Fresh Verification After Managed Config Draft Factory Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that introduced the managed-config draft factory boundary.

### Updated Frontier XIV

- `CP07-3` remains open.
- The next high-yield page-side frontier should stay near the top of `InstanceDetail.tsx`, now prioritizing the remaining pure presentation/notice helpers:
  - `getCapabilityTone`
  - `getManagementEntryTone`
  - `SectionAvailabilityNotice`
- `instanceWorkbenchServiceCore.ts` remains stable at `1132`, so the best next move is still page-side decomposition rather than a service-core pivot.

### Capability And Management Tone Presentation Extraction

- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts` now also owns the pure overview presentation helpers:
  - `getCapabilityTone(...)`
  - `getManagementEntryTone(...)`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` now imports those helpers from the presentation module instead of keeping the capability and management-entry tone mapping inline at the top of the page.
- This loop intentionally kept all authority-bearing work in the page and services:
  - `InstanceDetail.tsx` still owns `instanceService.*`, `toast.*`, `loadWorkbench(...)`, selection/dialog state, and read-only or availability guards
  - the presentation module still owns only pure label/tone/summary shaping
  - no Provider Center authority, Local Proxy routing, or desktop plugin/runtime boundary moved
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts` now verifies the extracted tone boundary directly, including:
  - `ready`, `degraded`, `planned`, and fallback capability tone mapping
  - `success`, `warning`, and `neutral` management-entry tone mapping
- `scripts/sdkwork-instances-contract.test.ts` now proves that:
  - `InstanceDetail.tsx` no longer keeps local `getCapabilityTone(...)` or `getManagementEntryTone(...)` helpers inline
  - `instanceDetailWorkbenchPresentation.ts` exports both helpers as part of the dedicated presentation boundary
- Fresh red/green verification in this loop was explicit:
  - `instanceDetailWorkbenchPresentation.test.ts` failed first because the presentation module did not yet export the two helpers
  - `scripts/sdkwork-instances-contract.test.ts` failed first because the page still kept both helper definitions inline
  - implementation landed only after those failures were observed

### OpenClaw Authority Checkpoints Re-read In This Loop

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts` still proves browser-backed workbench detail persists OpenClaw tasks, files, provider edits, and managed channel writes through the real bridge.
- `packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts` still keeps Provider Center authority, managed config writes, and remote OpenClaw provider routing outside the presentation boundary.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts` and `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts` still keep managed-provider authority and editability classification outside the page-top tone helpers.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` and `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs` remain the Local Proxy and desktop plugin/runtime boundary.

### Fresh Measurements After Tone Helper Extraction

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `2242`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `195`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `455`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`: `511`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1030`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`
- This loop records the fresh current-worktree hotspot profile after the tone-helper extraction. Because `CP07-3` was already carrying additional in-flight decomposition changes before this turn resumed, the closed-loop claim here is the new presentation boundary and verified rebasing, not attribution of the entire historical page delta to these two helpers alone.

### Fresh Verification After Tone Helper Extraction

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

All commands passed on fresh execution in the same loop that moved the two tone helpers into the presentation module.

### Updated Frontier XV

- `CP07-3` remains open.
- The next high-yield page-side frontier is now the remaining top-of-file presentation residue inside `InstanceDetail.tsx`:
  - `SectionAvailabilityNotice`
  - `SectionHeading`
  - then only the tiny `addPendingId(...)` / `removePendingId(...)` helpers remain at the page top
- The page still owns all write authority, so the next loop should continue extracting presentation-only pieces without moving service invocation, toast emission, or workbench reload authority.

