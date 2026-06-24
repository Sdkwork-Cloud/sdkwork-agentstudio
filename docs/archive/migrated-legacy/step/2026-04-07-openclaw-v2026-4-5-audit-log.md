# OpenClaw v2026.4.5 Audit Log

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Step 1: Confirm upstream baseline

- Official release baseline checked from GitHub Releases: latest tag is `v2026.4.5`.
- Official changelog reviewed from the tagged source tree.
- Official docs reviewed:
  - Control UI
  - Gateway configuration reference

## Step 2: Compare local architecture against upstream modules

| Module | Local status | Evidence | Notes |
| --- | --- | --- | --- |
| Release/runtime baseline | blocked-by-runtime-upgrade | `config/openclaw-release.json`, bundled desktop `manifest.json` still `2026.4.2`, `docs/step/2026-04-07-openclaw-v2026-4-5-runtime-upgrade-readiness.md` | The authoritative blocker state is now recorded in the runtime-upgrade-readiness step log; do not falsify parity by editing version strings without actually upgrading the bundled runtime assets. |
| Control UI language surface | partially-aligned | `packages/sdkwork-claw-i18n/src/config.ts`, `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`, `docs/step/2026-04-07-openclaw-v2026-4-5-language-surface-truthfulness.md`, `docs/step/2026-04-07-openclaw-v2026-4-5-language-label-autonym-cleanup.md` | Runtime language capability has been widened locally, the settings UI now uses native/autonym labels plus explicit fallback notes, but only `en` and `zh` remain dedicated local translation bundles. |
| Skills / ClawHub / install flows | aligned | `sdkwork-claw-market`, `clawHubService`, `agentSkillManagementService`, `AgentWorkbenchPanel` | Source already includes list/detail/reviews/install/uninstall and instance workbench jump points. |
| Memory / Dreaming / Dream Diary | aligned | `instanceWorkbenchServiceCore`, `InstanceDetail`, `instanceMemoryWorkbenchPresentation.*` | Latest iteration already closed Dream Diary reader and managed dreaming panel gaps. |
| Provider request overrides | aligned | `openClawProviderRequestDraft.*`, `InstanceDetail`, `instanceService.*` | Local source exposes JSON5 editing for `headers`, `auth`, `proxy`, and `tls`. |
| Channels / `contextVisibility` | aligned | `openClawConfigService.*` | Local source already exposes `contextVisibility` in channel config fields and persistence. |
| Chat / gateway session behavior | aligned | `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.*`, `packages/sdkwork-claw-chat/src/pages/Chat.tsx`, `packages/sdkwork-claw-chat/src/components/ChatSessionContextDrawer.tsx`, `packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.*`, `packages/sdkwork-claw-chat/src/services/openClawMessagePresentation.*` | Session thinking, fast, verbose, and reasoning overrides are now exposed and patched through the gateway; provider-aware `Default (<resolved>)` labels are implemented; assistant `commentary` payloads are buffered until `final_answer`. |
| Tasks / Task Flow runtime surface | aligned | `packages/sdkwork-claw-core/src/services/taskRuntimeService.*`, `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`, `packages/sdkwork-claw-commons/src/components/cronTasksManagerData.ts`, `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.*` | The `/tasks` surface now exposes detached runtime tasks plus Task Flow records through `tasks.list` and `tasks.flow.list`, while non-OpenClaw or older runtimes degrade truthfully. |
| Desktop/server/docker/k8s shared host architecture | partially-aligned | `docs/core/release-and-deployment.md`, `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.*`, `scripts/release/*.mjs`, host runtime contracts | Source-level architecture is unified and release evidence is now much stronger, but final packaged runtime proof still depends on live smoke outside sandbox. |
| Cross-OS release flow | partially-aligned | root `package.json`, release docs, release scripts/tests, desktop packaged startup smoke contracts | Windows/Linux/macOS packaging and Linux deployment families are encoded and contract-tested, but real packaged execution remains environment-bound. |

## Step 3: Local implementation landed in this cycle

### 3.1 Multi-language runtime surface hardening

Reason:

- OpenClaw `v2026.4.5` widened the Control UI language surface.
- Local app still hardcoded `en/zh`, which was a real architecture gap unrelated to bundled runtime
  download constraints.

Local fix strategy:

- Expand the supported runtime language set to include the OpenClaw `v2026.4.5` language surface.
- Keep `en` and `zh` as the canonical maintained translation source bundles for now.
- Map the newly exposed languages to stable fallback resources so the app remains functional today.
- Keep desktop tray and startup copy deterministic by falling back non-Chinese languages to English
  and Traditional Chinese to the existing Chinese path.

Files targeted:

- `packages/sdkwork-claw-i18n/src/config.ts`
- `packages/sdkwork-claw-i18n/src/index.ts`
- `packages/sdkwork-claw-i18n/src/localize.ts`
- `packages/sdkwork-claw-i18n/src/index.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/README.md`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs`

Expected outcome:

- Settings language selector can expose the broader OpenClaw-aligned locale surface.
- Persisted language preference can safely round-trip through web/desktop runtime contracts.
- Untranslated languages still render with a deterministic fallback instead of being silently
  rejected.

### 3.2 Chinese locale drift hardening

Reason:

- While validating the new language surface, the existing `en` and `zh` locale trees were found to
  be out of sync.
- That mismatch would have left the app vulnerable to missing-key regressions even without the new
  language expansion.

Local fix strategy:

- Keep the canonical translation source directories unchanged for this cycle.
- Assemble the `zh` runtime locale by deep-merging it over the `en` bundle so missing keys inherit
  stable English fallback strings.
- Preserve all existing Chinese translations while eliminating missing-key runtime failures.

Files targeted:

- `packages/sdkwork-claw-i18n/src/locales/mergeLocale.ts`
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
- `packages/sdkwork-claw-i18n/src/locales/README.md`

### 3.3 Chat session thinking-level parity landing

Reason:

- A new local parity gap was identified while re-reading the OpenClaw `v2026.4.5` web chat docs and
  changelog: gateway/store already supported `sessions.patch` with `thinkingLevel`, but the local
  chat UI exposed no control for it at all.

Local fix strategy:

- Add an explicit `setSessionThinkingLevel` mutation to the OpenClaw gateway session store.
- Re-expose that mutation through the shared chat store so the chat page can use it without
  breaking the existing route/package boundaries.
- Surface the control in the existing session context drawer rather than adding new chat-host-only
  business logic to the web/desktop shells.
- Keep the first landing minimal and verify the gateway patch path before refining the selector
  options.

Files targeted:

- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- `packages/sdkwork-claw-chat/src/store/chatStore.ts`
- `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- `packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
- `packages/sdkwork-claw-chat/src/components/ChatSessionContextDrawer.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/chat.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/chat.json`

Expected outcome:

- OpenClaw-backed chat sessions can change their `thinkingLevel` from the UI and persist the change
  through `sessions.patch`.
- Draft sessions keep the selected value locally before the remote session is fully materialized.
- Direct-model chat mode does not expose the OpenClaw-only control.

### 3.4 Provider-aware thinking-level selector refinement

Reason:

- The first selector landing fixed the missing control, but it still used a generic static list.
- The upstream web docs are stricter: the selector is provider-aware, and `z.ai` uses a binary
  `off/on` surface instead of the general multi-step reasoning list.

Local fix strategy:

- Move the selector-option decision into a dedicated pure service so provider heuristics stay out of
  the drawer component.
- Resolve the active model provider from the chat page's selected OpenClaw model and pass the
  allowed options into the drawer.
- Keep the default option label generic for now because the local runtime payload still does not
  expose the upstream-resolved default reasoning level that would be needed to render
  `Default (<resolved>)` honestly.

Files targeted:

- `packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.ts`
- `packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.test.ts`
- `packages/sdkwork-claw-chat/src/services/index.ts`
- `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- `packages/sdkwork-claw-chat/src/components/ChatSessionContextDrawer.tsx`
- `scripts/run-sdkwork-chat-check.mjs`
- `packages/sdkwork-claw-i18n/src/locales/en/chat.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/chat.json`

Expected outcome:

- Most OpenClaw providers show the shared reasoning list.
- `z.ai`-backed chat sessions only show `off/on`.
- The selector stays hidden until the active OpenClaw model is known.

## Step 4: Remaining hard blockers after this cycle

1. Bundled OpenClaw runtime is still `2026.4.2`.
   - This blocks claiming full `v2026.4.5` runtime parity.
   - A real fix requires importing newer upstream runtime assets, updating integrity metadata, and
     re-running bundled runtime verification.
2. Live packaged smoke for desktop/server/container/kubernetes is still environment-bound.
   - Source contracts exist locally.
   - Final packaged launch, Docker Compose, and Helm/kubectl proof still need execution outside the
     current sandbox.
3. Upstream-style resolved default reasoning labels are still not available locally.
   - The selector now exists and is provider-aware.
   - The local runtime/model payload still lacks the resolved default thinking-level metadata needed
     to render `Default (<resolved>)` without guessing.

## Verification

- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.test.ts`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
  - passed
- `node scripts/run-sdkwork-chat-check.mjs`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml config_normalizes_language_preference`
  - passed
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml config_preserves_supported_non_english_language_preferences`
  - passed
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml tray_language_uses_explicit_preference_before_system_locale`
  - passed
- `pnpm.cmd check:i18n`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

## Net Result Of This Cycle

Resolved locally:

1. Control UI language support no longer stops at `en/zh`; the runtime surface now accepts the
   broader OpenClaw `v2026.4.5` language set.
2. Desktop runtime config normalization and tray-language fallback now understand the expanded
   language set without regressing the Chinese/English tray behavior.
3. Existing `zh` locale drift no longer breaks key-alignment verification; missing Chinese keys now
   fall back deterministically.
4. OpenClaw chat sessions now expose a real `thinkingLevel` control in the session context drawer,
   and the selection persists through the gateway `sessions.patch` flow.
5. The local thinking-level selector now uses provider-aware option sets instead of a single static
   list, including a binary `off/on` path for `z.ai`.

Still blocked:

1. Bundled OpenClaw runtime is still version `2026.4.2`.
2. Real packaged desktop launch, Docker Compose, and Kubernetes cluster smoke still require live
   execution outside this sandbox even though source-level checks pass.
3. The local UI still cannot display the upstream-style `Default (<resolved>)` reasoning label
   because the resolved default level is not exposed by the local runtime/model payload yet.

## Step 5: Additional parity closure after module-by-module re-review

### 5.1 Tasks / Task Flow surface closure

Reason:

- OpenClaw `v2026.4.1` added the `/tasks` background task board, and the newer gateway surface now
  also exposes Task Flow records through `tasks.flow.list`.
- The current workspace already contained the implementation work for these surfaces, but the audit
  log had not yet classified or verified it explicitly.

Local fix strategy:

- Keep the scheduled-task CRUD surface inside the shared `CronTasksManager` instead of creating a
  second host-specific task page.
- Add a shared `taskRuntimeService` in `sdkwork-claw-core` that only probes detached runtime tasks
  and Task Flow records for OpenClaw instances.
- Route the task page data loader through one snapshot call so scheduled tasks, detached runtime
  tasks, Task Flow data, delivery channels, and agent catalog stay synchronized.
- Degrade gracefully when the connected runtime does not expose the latest task runtime surfaces yet
  instead of pretending the board is empty.

Files targeted:

- `packages/sdkwork-claw-core/src/services/taskRuntimeService.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
- `packages/sdkwork-claw-core/src/services/index.ts`
- `packages/sdkwork-claw-commons/src/components/cronTasksManagerData.ts`
- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `scripts/run-sdkwork-core-check.mjs`

Expected outcome:

- OpenClaw instances expose recent detached runtime tasks on the shared `/tasks` page.
- The same page exposes Task Flow records, sync modes, and flow linkage metadata from the latest
  gateway surface.
- Non-OpenClaw instances or older OpenClaw runtimes stay truthful by marking the latest runtime
  task surface unsupported instead of returning misleading empty-state data.

### 5.2 Desktop packaged startup evidence and release-flow proof hardening

Reason:

- The earlier audit correctly marked cross-mode runtime proof as incomplete, but it did not yet
  record the new local source-level evidence that already exists for packaged desktop launch and
  release finalization.
- Without that record, the repo looked weaker than it really is for desktop/server/docker/k8s
  architecture review.

Local fix strategy:

- Preserve a sanitized `desktop-startup-evidence.json` document so packaged desktop launch proof can
  survive release packaging without leaking browser session tokens or auth data.
- Make packaged desktop smoke wait for a ready `shell-mounted` evidence state and persist that
  captured evidence beside the release assets.
- Require release finalization to reject desktop assets when launched-session startup evidence is
  missing or stale.
- Keep server/container/kubernetes smoke at truthful packaged-bundle contract scope inside the
  sandbox, while continuing to classify real environment boot proof as external.

Files targeted:

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
- `scripts/release/desktop-startup-smoke-contract.mjs`
- `scripts/release/smoke-desktop-packaged-launch.mjs`
- `scripts/release/smoke-desktop-packaged-launch.test.mjs`
- `scripts/release/smoke-desktop-startup-evidence.mjs`
- `scripts/release/smoke-desktop-startup-evidence.test.mjs`
- `scripts/release/finalize-release-assets.test.mjs`
- `scripts/release/local-release-command.mjs`
- `docs/core/release-and-deployment.md`
- root `package.json`

Expected outcome:

- The desktop release flow preserves a structured packaged-startup evidence document and lifts that
  proof into final release metadata.
- Desktop/server/docker/k8s release families are contract-tested from one unified source tree.
- Remaining uncertainty is narrowed to live packaged execution outside the current sandbox rather
  than missing local release architecture.

### 5.3 Assistant phase/commentary alignment

Reason:

- The OpenClaw `v2026.4.5` changelog tightened assistant progress semantics by carrying assistant
  `phase` metadata and buffering `commentary` until `final_answer`.
- Local chat parsing still treated commentary text as a normal assistant reply, which would leak
  planning text into the transcript if a newer runtime started sending phase-tagged assistant
  payloads.

Local fix strategy:

- Extend the pure OpenClaw message presentation parser so it reads assistant `phase` metadata from
  payloads.
- Treat assistant `commentary` as non-user-visible transcript text while preserving tool-event
  progress cards as the live progress surface.
- Add a store-level regression that proves commentary-only chat events stay hidden until the final
  answer arrives.

Files targeted:

- `packages/sdkwork-claw-chat/src/services/openClawMessagePresentation.ts`
- `packages/sdkwork-claw-chat/src/services/openClawMessagePresentation.test.ts`
- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`

Expected outcome:

- Phase-tagged assistant commentary no longer appears as a normal reply bubble.
- Tool progress remains visible through the existing tool-card stream.
- Final answers continue to materialize normally once the gateway emits `final_answer`.

## Step 6: Verification feedback from the extended cycle

Command corrections:

- A direct raw invocation of `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
  failed because package-resolution aliases are meant to run through the repo check entrypoint.
- A direct `node --test` invocation of
  `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts` failed with
  a local `spawn EPERM`; the repo already runs this file correctly through the strip-types path.
- After switching back to the repository's canonical verification commands, the same code passed.

Fresh verification:

- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
  - passed
- `node scripts/release/smoke-desktop-startup-evidence.test.mjs`
  - passed
- `node scripts/release/smoke-desktop-packaged-launch.test.mjs`
  - passed
- `pnpm.cmd check:sdkwork-instances`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed
- `pnpm.cmd check:release-flow`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openClawMessagePresentation.test.ts`
  - passed
- `node scripts/run-sdkwork-chat-check.mjs`
  - passed

## Step 7: Net result after the extended review loop

Resolved locally:

1. The OpenClaw-aligned `/tasks` surface is no longer limited to scheduled cron CRUD; it now also
   exposes detached runtime tasks and Task Flow data through shared services and shared UI.
2. The detached runtime task board stays truthful for older or non-OpenClaw runtimes by surfacing
   unsupported-state messaging instead of silently flattening the feature into an empty list.
3. Desktop packaged-launch evidence is now treated as a first-class release contract artifact and
   is validated before final release metadata can be considered complete.
4. Desktop, server, container, and kubernetes release families now share stronger automated
   contract coverage from one workspace-level release flow instead of only ad hoc documentation.
5. Phase-tagged assistant commentary is now suppressed locally until a real final answer arrives,
   which keeps newer OpenClaw progress semantics from leaking planning text into the chat transcript.

Still blocked:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

## Step 16: Shared usage workspace parity landing

Reason:

- Upstream OpenClaw exposes a real usage tab, but local `claw-studio` still had no shared `/usage`
  workspace even though the gateway client already supported the required usage endpoints.
- That made the repo structurally incomplete: transport existed, but shell, dashboard, and contract
  surfaces were missing.

Local fix strategy:

- finish the shared `UsageWorkspace` inside `sdkwork-claw-dashboard`
- keep usage data loading inside `usageWorkspaceService`
- wire `/usage` through shared shell surfaces only:
  - route
  - sidebar
  - command palette
  - route prefetch
  - settings visibility
- add dashboard and shell contract coverage
- add a dedicated dashboard check runner so the usage tests actually execute from the repo entrypoint

Files targeted:

- `packages/sdkwork-claw-dashboard/src/pages/UsageWorkspace.tsx`
- `packages/sdkwork-claw-dashboard/src/services/usageWorkspaceService.ts`
- `packages/sdkwork-claw-dashboard/package.json`
- `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`
- `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
- `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/dashboard.json`
- `packages/sdkwork-claw-i18n/src/locales/en/sidebar.json`
- `packages/sdkwork-claw-i18n/src/locales/en/commandPalette.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
- `scripts/check-sdkwork-claw-route-surface.mjs`
- `scripts/sdkwork-dashboard-contract.test.ts`
- `scripts/sdkwork-shell-contract.test.ts`
- `scripts/run-sdkwork-dashboard-check.mjs`
- root `package.json`
- `docs/step/2026-04-07-openclaw-v2026-4-5-usage-workspace-gap.md`

Verification:

- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `node scripts/run-sdkwork-dashboard-check.mjs`
  - passed
- `pnpm.cmd check:sdkwork-dashboard`
  - passed
- `pnpm.cmd check:sdkwork-shell`
  - passed
- `pnpm.cmd check:i18n`
  - passed
- `pnpm.cmd check:sdkwork-routes`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed
- `pnpm.cmd build`
  - passed

Net result:

1. Local app now exposes a real shared `/usage` workspace instead of leaving usage parity stranded
   at the gateway transport layer.
2. The new usage surface stays inside the shared dashboard/shell architecture and remains valid
   across web and desktop hosts.
3. Workspace, desktop, and server verification all remained green after the landing.
4. The landing is intentionally classified as partial upstream UI parity because advanced upstream
   filtering, chart-mode, and column/log tuning behaviors are still not fully ported.

## Step 20: Language-surface truthfulness follow-up

Reason:

- The earlier locale-expansion work widened the shared language surface, but the settings selector
  still rendered fallback-backed locales as if they were equivalent full translations.
- A fresh local upstream re-review showed the checked-in OpenClaw locale directory currently
  includes dedicated source files for `de`, `en`, `es`, `pt-BR`, `zh-CN`, and `zh-TW`, while the
  local repo still maintains only `en` and `zh` as dedicated source bundles.
- That meant the current UI was still too optimistic even though the broader locale surface itself
  was intentional and functional.

Local fix strategy:

- Keep the broader language normalization and runtime acceptance that already landed.
- Add shared metadata that distinguishes dedicated translation bundles from fallback-backed locale
  entries.
- Switch language labels to native/autonym labels and surface fallback notes directly in
  `GeneralSettings`.
- Preserve the matching Chinese fallback copy through `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
  because direct editing of `zh/settings.json` remained encoding-risky in this environment.
- Record the full evidence in
  `docs/step/2026-04-07-openclaw-v2026-4-5-language-surface-truthfulness.md`.

Files targeted:

- `packages/sdkwork-claw-i18n/src/config.ts`
- `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`
- `packages/sdkwork-claw-i18n/src/index.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/en/settings.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`
- `packages/sdkwork-claw-i18n/src/locales/README.md`
- `scripts/sdkwork-settings-contract.test.ts`

Expected outcome:

- The settings selector keeps the broader OpenClaw-aligned locale surface without overstating the
  current translation depth.
- Non-dedicated locales now show explicit fallback notes in the shared settings UI.
- Web, desktop, server, Docker, and k8s modes all reuse the same truthful language-surface
  metadata because the landing stays in shared packages.

Fresh verification:

- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `pnpm.cmd check:i18n`
  - passed

## Step 21: Net result after the language-surface truthfulness loop

Resolved locally:

1. The shared i18n layer now exposes dedicated-bundle metadata instead of forcing the settings UI to
   guess which locales are fully translated.
2. The settings language selector now uses native labels and explicit fallback notes, so the wider
   locale surface is materially more truthful across every host mode.
3. Locale compatibility bundles and shared settings contracts remained green after the landing, so
   the truthfulness improvement did not regress the current multi-mode architecture.

Still blocked:

1. Only `en` and `zh` remain dedicated local translation source bundles in this repo.
2. Upstream dedicated locale bundles such as `de`, `es`, `pt-BR`, and `zh-TW` are not yet imported
   and maintained locally.
3. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
4. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

## Step 22: Language-label autonym cleanup

Reason:

- The language-surface truthfulness loop had already moved most supported-language labels to native
  names, but `pl` and `id` still used English exonyms in the shared label map.
- That was a small but real inconsistency in the same shared metadata now used by every host mode.

Local fix strategy:

- Use TDD to lock the remaining native-label expectations in `packages/sdkwork-claw-i18n/src/index.test.ts`.
- Apply the smallest possible metadata-only fix in `packages/sdkwork-claw-i18n/src/config.ts`.
- Record the evidence in
  `docs/step/2026-04-07-openclaw-v2026-4-5-language-label-autonym-cleanup.md`.

Files targeted:

- `packages/sdkwork-claw-i18n/src/index.test.ts`
- `packages/sdkwork-claw-i18n/src/config.ts`

Fresh verification:

- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `pnpm.cmd check:i18n`
  - passed

## Step 23: Net result after the autonym cleanup

Resolved locally:

1. The supported-language label set now uses native/autonym labels consistently for the full current
   language surface.
2. The earlier language-surface truthfulness landing is now internally consistent instead of leaving
   `pl` and `id` behind as English-only labels.

Still blocked:

1. Dedicated translation-bundle parity is still incomplete even though the label metadata is now
   cleaner.
2. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
3. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

## Step 19: Bundled runtime upgrade readiness gate

Reason:

- After the source-level parity loops, the highest remaining blocker was still the real bundled
  OpenClaw runtime version.
- That blocker needed stronger evidence than a generic note, because the workspace now contains a
  new readiness diagnostic and the local upstream checkout is also dirty.

Local fix strategy:

- Add an explicit runtime-upgrade-readiness loop that proves whether a real `v2026.4.5` upgrade can
  happen from the current workspace state.
- Record both the Node diagnostic output and the shell-only dirty-check evidence in a dedicated
  step log so future upgrade work has an operator-safe entrypoint.

Authoritative follow-up:

- `docs/step/2026-04-07-openclaw-v2026-4-5-runtime-upgrade-readiness.md`

Current conclusion:

1. The bundled runtime blocker is still real.
2. The blocker is now evidence-backed and operator-ready instead of being a vague parity caveat.
3. No version-source files should be bumped to `2026.4.5` until that readiness gate turns green.

## Step 18: Authoritative follow-up for Ollama closure and Cloudflare AI Gateway parity

The latest follow-up loop for this audit is recorded separately in:

- `docs/step/2026-04-07-openclaw-v2026-4-5-audit-loop-18.md`

That follow-up supersedes two stale blocker conclusions still present in earlier append-only
sections of this file:

1. `Ollama` is no longer a blocker.
   - Native shared/provider/runtime parity was closed and re-verified.
2. `Cloudflare AI Gateway` is no longer missing from the shared Provider Center known-provider
   surface.
   - Shared request overrides plus curated provider metadata are now both present.

Current authoritative blockers after the follow-up loop:

1. Bundled OpenClaw runtime assets are still `2026.4.2`.
2. Real packaged desktop, Docker/Compose, and Kubernetes live smoke still require execution outside
   the current sandbox.

## Step 14: Cloudflare AI Gateway request-override parity closure

Reason:

- Re-reviewing the official OpenClaw `v2026.4.5` provider docs showed `cloudflare-ai-gateway`
  is not just another named preset. It is an Anthropic-compatible route that can require gateway
  request metadata such as the optional `cf-aig-authorization` header.
- Local route/channel definitions already exposed the provider id and protocol mapping, but the
  current shared architecture still dropped request overrides along the save/apply path:
  - `ProviderConfigCenter` normalized runtime config without preserving `config.request`
  - `providerRoutingCatalogService` persisted route runtime config without preserving
    `config.request`
  - `openClawLocalProxyProjectionService` projected managed local proxy providers without
    preserving `config.request`
- That meant Cloudflare AI Gateway could appear supported in the catalog while silently losing the
  headers needed for an honest managed OpenClaw projection.

Local fix strategy:

- Introduce one shared core runtime-config normalizer for OpenClaw provider runtime settings,
  including normalized request overrides for:
  - headers
  - auth
  - proxy
  - tls
- Reuse that helper in the provider-routing persistence layer and the settings Provider Center
  service so route records round-trip request overrides instead of dropping them.
- Extend managed local proxy projection so projected provider config keeps normalized request
  overrides when a saved route carries them.
- Keep the change inside shared `sdkwork-claw-core` and `sdkwork-claw-settings` layers so
  web/desktop/server/docker/k8s architecture stays unified and no host-specific workaround is
  introduced.

Files targeted:

- `packages/sdkwork-claw-core/src/services/openClawProviderRuntimeConfigService.ts`
- `packages/sdkwork-claw-core/src/services/index.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`

Expected outcome:

- Provider Center route records no longer lose request override metadata when saved to the shared
  route catalog and read back.
- Applying a saved provider config through the managed local proxy projection keeps request
  overrides intact for the generated OpenClaw provider config.
- Cloudflare AI Gateway-compatible headers such as `cf-aig-authorization` survive the shared
  route -> storage -> projection path instead of being dropped silently.

Fresh verification:

- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.test.ts`
  - passed
- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

Verification feedback:

- The focused red/green cycle first reproduced the actual defect in three places:
  - managed local proxy projection dropped `request`
  - provider routing catalog persistence dropped `request`
  - Provider Center save/list flow dropped `request`
- After the shared helper landing, all three paths turned green under the existing core/settings
  verification runners, and the broader workspace/desktop/server checks remained green.
- Desktop/server source-level architecture checks still confirm that the change did not regress the
  unified host contracts across browser, desktop, server, docker, or kubernetes packaging logic.

## Step 15: Net result after the Cloudflare parity loop

Resolved locally:

1. Cloudflare AI Gateway-compatible request override metadata is no longer lost in the shared
   Provider Center save/list/apply pipeline.
2. Managed local proxy projection now preserves normalized request overrides when a route requires
   custom headers, auth, proxy, or TLS metadata.
3. Shared provider runtime config normalization now lives in one core helper instead of being
   partially duplicated across persistence layers.
4. Fresh workspace, desktop, and server verification stayed green after the parity fix.

Still blocked:

1. `ProviderConfigEditorSheet` still does not expose request-override authoring in the UI, so this
   loop closes the shared runtime pipeline but not the full editor surface for manual Cloudflare
   configuration.
2. `ollama` still requires native upstream protocol support and an honest `api: "ollama"` path;
   it should not be faked as another OpenAI-compatible preset.
3. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade.
4. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

## Step 16: Provider Center parity closure for Groq, SGLang, and Vercel AI Gateway

Reason:

- On 2026-04-07, the official OpenClaw provider directory was re-reviewed again after the earlier
  Fireworks / Bedrock Mantle / Together / LiteLLM / Kilo Code / vLLM / Venice parity landings.
- That re-review showed three remaining provider surfaces that map cleanly onto the current shared
  Provider Center architecture without faking native runtime support:
  - `Groq`
    - OpenClaw provider docs expose the OpenAI-compatible provider with the starter model
      `groq/llama-3.3-70b-versatile`.
  - `SGLang`
    - OpenClaw provider docs expose the self-hosted OpenAI-compatible endpoint at
      `http://127.0.0.1:30000/v1`.
  - `Vercel AI Gateway`
    - OpenClaw provider docs classify it as an Anthropic Messages API provider.
    - Official Vercel docs confirm the gateway base URL is `https://ai-gateway.vercel.sh`.
- The same module-by-module review also clarified which remaining provider pages should not be
  patched into Provider Center yet:
  - `Perplexity` is documented in the OpenClaw provider directory as a web-search provider, not a
    shared model-route preset target.
  - `Ollama` still requires its own native `api: "ollama"` transport shape, which the current
    shared local proxy route protocol union does not expose.
  - `Cloudflare AI Gateway` can require extra `cf-aig-authorization` gateway headers, which the
    current Provider Center route schema still cannot express truthfully.

Local fix strategy:

- Add `groq`, `sglang`, and `vercel-ai-gateway` into the shared
  `providerRoutingCatalogService` channel catalog so they appear as first-class official providers
  instead of generic dynamic fallbacks.
- Add curated Provider Center presets aligned to the current official docs:
  - `Groq`
    - base URL: `https://api.groq.com/openai/v1`
    - default model: `llama-3.3-70b-versatile`
  - `SGLang`
    - base URL: `http://127.0.0.1:30000/v1`
    - placeholder API key: `sglang-local`
    - model ids intentionally left user-supplied
  - `Vercel AI Gateway`
    - client protocol: `anthropic`
    - upstream protocol: `anthropic`
    - base URL: `https://ai-gateway.vercel.sh`
    - default model: `anthropic/claude-opus-4.6`
- Extend shared protocol inference so `vercel-ai-gateway` and `cloudflare-ai-gateway` resolve to
  the Anthropic route family instead of incorrectly defaulting to `openai-compatible` when entered
  manually.
- Keep the full landing in shared `core/settings` layers so web, desktop, server, docker, and k8s
  continue to consume one provider architecture.

Files targeted:

- `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigImportService.ts`

Expected outcome:

- Provider Center exposes truthful shared presets for `Groq`, `SGLang`, and `Vercel AI Gateway`
  without splitting provider onboarding by host mode.
- Anthropic-family gateway providers no longer silently normalize to the wrong local proxy
  protocol when users type the provider id manually.
- The remaining unsupported provider pages are documented as real architecture gaps rather than
  hidden behind misleading template-only support.

Fresh verification:

- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

Verification feedback:

- The full workspace `lint` sweep stayed green after the new provider batch, so the Groq /
  SGLang / Vercel additions remained stable inside the standard parity pipeline instead of only
  passing as isolated tests.
- Desktop and server contract checks also stayed green, so the provider expansion did not regress
  the current shared multi-mode host architecture.
- The desktop contract sweep still reports the bundled OpenClaw runtime as `2026.4.2`, which
  remains a truthful blocker rather than a regression introduced by this loop.

## Step 17: Net result after the latest provider review loop

Resolved locally:

1. Provider Center now recognizes `Groq`, `SGLang`, and `Vercel AI Gateway` as first-class shared
   provider definitions instead of leaving them outside the official known-provider surface.
2. Shared presets now cover one more honest Anthropic-gateway provider class (`Vercel AI Gateway`)
   and two more OpenAI-compatible providers (`Groq`, `SGLang`) without adding host-specific route
   code.
3. Manual route creation is now safer for Anthropic-style gateways because `vercel-ai-gateway` and
   `cloudflare-ai-gateway` no longer fall back to the wrong inferred protocol family.
4. Workspace, desktop, and server verification remained green after the change, so the current
   web/desktop/server shared architecture continues to hold.

Remaining real blockers:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts pass.
3. `Ollama` still needs a native shared upstream protocol and route schema instead of another
   OpenAI-compatible preset patch.
4. `Cloudflare AI Gateway` still needs richer shared request metadata so Provider Center can model
   optional gateway-auth headers truthfully instead of relying on manual native config edits.

Next review target:

1. Re-check whether the next honest provider-center landing should be:
   - a native `ollama` protocol extension in the shared local proxy route model
   - richer request metadata support for gateway-specific headers such as Cloudflare
   - or continued source-level/runtime-level upgrade work against the still-bundled OpenClaw
     `2026.4.2` assets

## Step 14: Provider Center parity extension for official proxy and gateway providers

Reason:

- Re-checking the official provider directory after the Fireworks/Bedrock Mantle landing showed the
  previous provider review was still incomplete.
- The current OpenClaw docs also publish first-class provider pages for `Together`, `LiteLLM`,
  `Kilo Code`, `vLLM`, and `Venice`, with explicit provider ids, base URLs, and starter models or
  local endpoint samples.
- Those providers fit the existing shared Provider Center architecture because they can be modeled
  honestly as OpenAI-compatible upstream routes without inventing host-specific logic.
- A second local gap surfaced during this work: the new core provider catalog test file was not yet
  included in `scripts/run-sdkwork-core-check.mjs`, so the workspace core regression runner was not
  actually proving those catalog assertions.

Local fix strategy:

- Extend the shared `providerRoutingCatalogService` channel catalog with:
  - `together`
  - `litellm`
  - `kilocode`
  - `vllm`
  - `venice`
- Add curated Provider Center presets aligned to the current provider docs:
  - `Together`
    - base URL: `https://api.together.xyz/v1`
    - default model: `moonshotai/Kimi-K2.5`
  - `LiteLLM`
    - base URL: `http://localhost:4000`
    - default model: `claude-opus-4-6`
  - `Kilo Code`
    - base URL: `https://api.kilo.ai/api/gateway/`
    - default model: `kilo/auto`
  - `vLLM`
    - base URL: `http://127.0.0.1:8000/v1`
    - starter API key: `vllm-local`
    - model ids intentionally left user-supplied
  - `Venice`
    - base URL: `https://api.venice.ai/api/v1`
    - default model: `kimi-k2-5`
- Extend the known-provider metadata tests and the Provider Center preset tests so this second
  batch of provider docs is covered by the same shared regression surface as the earlier provider
  parity work.
- Close the verification gap by adding `providerRoutingCatalogService.test.ts` into
  `scripts/run-sdkwork-core-check.mjs` and asserting that inclusion from
  `scripts/sdkwork-core-contract.test.ts`.

Files targeted:

- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigImportService.ts`
- `scripts/run-sdkwork-core-check.mjs`
- `scripts/sdkwork-core-contract.test.ts`

Expected outcome:

- Provider Center exposes a broader truthful slice of the official OpenClaw provider directory for
  providers that map cleanly onto the existing shared proxy-route architecture.
- Core regression automation now actually executes the provider routing catalog tests instead of
  silently omitting them from the standard core check entrypoint.
- Shared provider parity remains implemented in `core/settings` services rather than being split by
  web, desktop, server, docker, or k8s host mode.

Fresh verification:

- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

Verification feedback:

- The refreshed `core-check` output now explicitly includes:
  - `provider routing catalog exposes official Fireworks and Amazon Bedrock Mantle channels`
  - `provider routing catalog exposes additional official proxy and gateway providers from the current OpenClaw directory`
- The full workspace `lint` sweep remained green after the runner inclusion fix, so the new core
  test is not only present in source but also stable inside the standard parity pipeline.
- Fresh desktop and server checks remained green after the provider expansion, so the shared
  provider changes did not regress multi-mode host contracts.

## Step 15: Net result after the extended provider review

Resolved locally:

1. Provider Center now recognizes an extended official provider set that includes `Together`,
   `LiteLLM`, `Kilo Code`, `vLLM`, and `Venice` in addition to the earlier Fireworks and Bedrock
   Mantle parity work.
2. The new provider presets are implemented entirely in shared `core/settings` service layers, so
   web, desktop, server, docker, and k8s modes continue to consume one provider architecture rather
   than drifting into host-specific forks.
3. The standard `sdkwork-core` verification entrypoint now executes the provider routing catalog
   tests, closing a real regression-hole in the repository’s core quality gate.
4. Fresh workspace, desktop, and server verification stayed green after the second provider parity
   batch, so this loop improved coverage without destabilizing the release or host-runtime
   contracts.

Remaining real blockers:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

Next review target:

1. Re-check the remaining official provider pages that do not map as cleanly onto the current
   Provider Center route model, especially providers that may need custom headers, alternate auth
   envelopes, or non-standard protocol expectations, and determine whether they require:
   - a truthful “not yet supported by Provider Center” classification
   - additional shared route metadata support
   - or a separate native provider-management surface rather than another preset-only patch

## Step 12: Provider Center parity closure for Fireworks and Amazon Bedrock Mantle

Reason:

- On 2026-04-07, the upstream baseline was re-validated against the official GitHub Releases page:
  latest stable remains `v2026.4.5`, published on 2026-04-06.
- The official OpenClaw provider docs confirm both `Fireworks` and `Amazon Bedrock Mantle` are
  first-class providers in the current docs surface.
- Local source already carried recent provider parity work for `qwen`, `minimax`, and `stepfun`,
  but the shared provider catalog and Provider Center presets still omitted `fireworks` and
  `amazon-bedrock-mantle`.
- Re-reading the latest Fireworks docs also showed that the earlier local expectation was stale:
  the current starter model is
  `fireworks/accounts/fireworks/routers/kimi-k2p5-turbo`, not the earlier
  `accounts/fireworks/models/deepseek-v3p1` assumption.
- The latest Bedrock Mantle manual config example uses
  `https://bedrock-mantle.us-east-1.api.aws/v1` with `gpt-oss-120b`, so the earlier
  placeholder-only preset shape was no longer the best parity target.

Local fix strategy:

- Add `fireworks` and `amazon-bedrock-mantle` into the shared
  `providerRoutingCatalogService` channel catalog so all known-provider views treat them as
  first-class channel definitions instead of dynamic fallbacks.
- Add curated Provider Center presets aligned to the latest official docs:
  - `Fireworks`
    - base URL: `https://api.fireworks.ai/inference/v1`
    - default model: `fireworks/accounts/fireworks/routers/kimi-k2p5-turbo`
  - `Amazon Bedrock Mantle`
    - base URL: `https://bedrock-mantle.us-east-1.api.aws/v1`
    - default/reasoning model: `gpt-oss-120b`
- Promote both providers in the known-provider option ordering and import labels so the user-facing
  settings surface stays coherent after the new presets land.
- Update the parity tests to match the current upstream docs instead of preserving the older stale
  Fireworks model id and generic Bedrock Mantle placeholder endpoint.

Files targeted:

- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.ts`
- `packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigImportService.ts`

Expected outcome:

- Provider Center exposes official Fireworks and Amazon Bedrock Mantle options as real curated
  presets instead of forcing users into blank template configuration for those providers.
- Known-provider metadata, preset base URLs, and starter models stay aligned with the latest
  official provider docs.
- The shared provider architecture remains unified across web and desktop shells because the change
  stays inside the shared core/settings service layers.

Fresh verification:

- `node scripts/run-sdkwork-settings-check.mjs`
  - passed
- `node scripts/run-sdkwork-core-check.mjs`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed
- `pnpm.cmd check:desktop`
  - passed
- `pnpm.cmd check:server`
  - passed

Verification feedback:

- The workspace-level `lint` run also re-executed the broader parity and automation suites,
  including release-flow, desktop packaged launch smoke contracts, server bundle smoke contracts,
  and container/kubernetes deployment smoke contracts at source-contract scope.
- Those checks stayed green after the provider parity landing, so the new provider definitions did
  not regress the shared desktop/server/docker/k8s architecture contracts.

## Step 13: Net result after the provider parity loop

Resolved locally:

1. `fireworks` and `amazon-bedrock-mantle` are now first-class provider channel definitions in the
   shared routing catalog instead of being invisible gaps in the Provider Center known-provider
   surface.
2. Provider Center now ships curated Fireworks and Amazon Bedrock Mantle presets aligned with the
   current official docs, including the current Fireworks starter model and the Bedrock Mantle
   manual config sample.
3. The settings editor, known-provider selector, and import-label surface now stay coherent after
   those providers appear, so the provider architecture remains shared rather than forked by host.
4. Fresh workspace, desktop, and server verification stayed green after the change, and the broader
   contract suite still covers source-level desktop/server/docker/k8s release architecture.

Still blocked:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.
3. The chat UI still cannot display the upstream-style `Default (<resolved>)` reasoning label
   because the resolved default level is not exposed by the local runtime/model payload yet.

## Step 8: Resolved default thinking-label parity re-review

Reason:

- The earlier blocker classification for `Default (<resolved>)` was too conservative.
- Re-reading the official OpenClaw docs showed the web chat default-thinking label is not a hidden
  runtime-only value; the control UI resolves it from the active session model using documented
  rules:
  - `adaptive` for Claude 4.6 on Anthropic/Bedrock
  - `low` for other reasoning-capable models
  - `off` otherwise
- The same docs also confirm that `z.ai` exposes a binary `off/on` selector and treats any
  non-`off` level as enabled thinking, so the resolved default must be mapped onto that binary UI
  surface rather than rendered as `low`.

Local fix strategy:

- Extend the existing pure `chatThinkingLevelOptions` service with a second pure resolver that
  computes the provider-aware resolved default option from the active model reference.
- Keep the implementation honest by falling back to the plain runtime-default label whenever no
  active OpenClaw model is known yet.
- Reuse the existing drawer instead of introducing another host-specific control surface: the chat
  page now computes a translated `Default (<resolved>)` label and passes it into the drawer.
- Preserve the existing provider-aware selector options, including the binary `z.ai` path.

Files targeted:

- `packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.ts`
- `packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.test.ts`
- `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- `packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
- `packages/sdkwork-claw-chat/src/components/ChatSessionContextDrawer.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/chat.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/chat.json`

Expected outcome:

- The OpenClaw chat session picker no longer shows a generic "Use runtime default" label when the
  active model is already known.
- Anthropic/Bedrock Claude 4.6 models show `Default (Adaptive)` locally.
- Other reasoning-capable models show `Default (Low)` locally.
- `z.ai` models keep the binary picker surface and show `Default (On)` when the documented default
  resolves to a non-`off` thinking state.

Fresh verification:

- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatThinkingLevelOptions.test.ts`
  - passed
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
  - passed
- `node scripts/run-sdkwork-chat-check.mjs`
  - passed
- `pnpm.cmd lint`
  - passed
- `pnpm.cmd build`
  - passed

## Step 9: Net result after the latest review loop

Resolved locally:

1. The OpenClaw chat thinking-level control now mirrors the upstream `Default (<resolved>)`
   semantics instead of exposing only a generic runtime-default placeholder.
2. The resolved default label is now provider-aware and matches the documented OpenClaw web chat
   rules for Anthropic/Bedrock Claude 4.6, other reasoning-capable models, and binary `z.ai`
   pickers.
3. The previous audit blocker around default thinking-label parity is now closed without faking
   runtime metadata or hardcoding bundle version strings.

Still blocked:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.

Next review target:

1. Re-check official OpenClaw source for whether `sessions.patch` surfaces like `fastMode`,
   `verboseLevel`, and `reasoningLevel` are meant to be user-visible in the control UI or remain
   protocol-only/runtime-only controls, then either record them as intentionally unsupported or land
   the missing UI parity in another focused loop.

## Step 10: Session override parity closure for fast / verbose / reasoning

Reason:

- The previous audit left `fastMode`, `verboseLevel`, and `reasoningLevel` in a suspicious state:
  gateway protocol types and the client already accepted them, but the local session model, store
  hydration, and chat UI dropped them on the floor.
- Re-checking the official docs closed the ambiguity:
  - Control UI capability docs explicitly list `Sessions: list + per-session model/thinking/fast/verbose/reasoning overrides`.
  - Thinking docs define the session semantics for `/fast`, `/verbose`, and `/reasoning`, including
    `inherit` clearing for verbose and the `stream` reasoning mode note.
- That means the gap was not an intentional product omission; it was a real local parity defect.

Local fix strategy:

- Promote `fastMode`, `verboseLevel`, and `reasoningLevel` into the authoritative
  `OpenClawGatewayChatSession` and shared `ChatSession` models instead of leaving them protocol-only.
- Treat `sessions.list` and `sessions.patch` as the authoritative sources for these overrides, while
  allowing `session.message` and other live payloads to incrementally refresh them when the gateway
  echoes the fields.
- Keep history refresh honest: if `chat.history` omits these fields, preserve the existing
  authoritative session override metadata instead of nulling it out.
- Preserve override metadata even when `operator.read` blocks transcript history, because session
  rows can still carry the correct per-session settings.
- Reuse the existing session context drawer and extend it with three additional session-level
  controls rather than creating a host-specific control surface.

Files targeted:

- `packages/sdkwork-claw-chat/src/services/openclaw/gatewayProtocol.ts`
- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts`
- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- `packages/sdkwork-claw-chat/src/store/chatStore.ts`
- `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- `packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
- `packages/sdkwork-claw-chat/src/components/ChatSessionContextDrawer.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/chat.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/chat.json`

Expected outcome:

- OpenClaw-backed chat sessions now keep `fastMode`, `verboseLevel`, and `reasoningLevel` in the
  same authoritative local session snapshot as `thinkingLevel`.
- Session override metadata survives normal `chat.history` refreshes even when the history payload
  omits those fields, and it is no longer incorrectly cleared on `operator.read` history failures.
- The session context drawer exposes persistent session overrides for:
  - thinking
  - fast mode
  - verbose output
  - reasoning output
- The browser chat now stays aligned with the upstream session-override surface instead of only
  exposing the thinking picker.

Fresh verification:

- `node --experimental-strip-types packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
  - passed
- `node scripts/run-sdkwork-chat-check.mjs`
  - passed

## Step 11: Net result after the current parity loop

Resolved locally:

1. `fastMode`, `verboseLevel`, and `reasoningLevel` are no longer stranded in gateway protocol
   types; they now flow through the authoritative session store, the shared chat store, and the
   session context UI.
2. `sessions.list` row metadata is now treated as authoritative session-state input instead of being
   discarded until a later history refresh.
3. Session override metadata is preserved correctly when `chat.history` omits those fields and when
   transcript history is blocked by `operator.read`.
4. The local chat UI now mirrors the upstream OpenClaw session override surface more honestly:
   thinking, fast mode, verbose output, and reasoning output all patch persistent session state
   immediately through `sessions.patch`.

Still blocked:

1. Bundled OpenClaw runtime is still version `2026.4.2`, so full `v2026.4.5` runtime parity still
   requires a real bundled runtime upgrade instead of more UI-side patching.
2. Real packaged desktop launch, Docker Compose startup, and Kubernetes cluster smoke still need
   live execution outside this sandbox even though the source-level and packaging contracts now pass.
