# OpenClaw Runtime Task Detail Surface Parity

## Objective

- Continue the OpenClaw parity audit with one narrow, verifiable loop.
- Re-check whether the local task studio exposes the official detached runtime-task detail surface
  behind upstream `tasks.show`.
- Land the smallest truthful fix across `gateway -> core -> shared UI -> i18n -> contract` without
  reopening wider task-runtime refactors.

## Upstream Evidence Reviewed

Primary upstream sources re-checked in this loop:

- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`

What the review established:

1. upstream officially exposes detached task detail through `tasks.show`
2. upstream `TaskRunDetail` is the same operator-facing shape as `TaskRunView`
3. upstream human-facing `tasks.show` prints detail fields that matter operationally:
   - `sourceId`
   - `status`
   - `result`
   - `delivery`
   - `notify`
   - `ownerKey`
   - `childSessionKey`
   - `parentTaskId`
   - `agentId`
   - `runId`
   - timestamps
   - `cleanupAfter`

## Problem Found

Before this loop, the local app still had a real parity gap:

1. infrastructure already declared the official `tasks.show` gateway method in the allowed surface
2. local runtime-task UI only exposed the summary board from `tasks.list`
3. there was no detached runtime-task detail bridge in:
   - gateway client
   - shared core service
   - runtime task board UI
4. operators therefore could not inspect a detached runtime task with the same depth that upstream
   already exposes

This meant the local board surfaced task counts and summary rows, but not the real operator detail
path.

## Design Decision

Keep this loop narrow and evidence-driven:

1. normalize detached runtime task detail with the same shape already used for linked Task Flow
   tasks
2. expose a dedicated `getRuntimeTaskDetail()` seam in infrastructure and core
3. add a `Details` action to runtime task cards
4. render a dedicated runtime-task detail overlay with operator-relevant fields only
5. add only the locale keys that are truly different from Task Flow detail copy

Explicit non-goals:

1. do not refactor the entire runtime board into separate components
2. do not invent new semantics for fields that upstream does not elevate
3. do not broaden this pass into unrelated Task Flow or cron changes

## TDD Record

### Red

Failing expectations were in place before production changes:

1. `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
   - expected `client.getRuntimeTaskDetail()` to call official `tasks.show`
2. `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
   - expected `service.getRuntimeTaskDetail()` for OpenClaw instances
3. `scripts/sdkwork-tasks-contract.test.ts`
   - expected a runtime-task detail entrypoint and dedicated task-board detail copy

Fresh red evidence captured in this loop:

```bash
node scripts/run-sdkwork-foundation-check.mjs
node scripts/run-sdkwork-core-check.mjs
pnpm.cmd check:sdkwork-tasks
```

Observed failures:

1. foundation failed with:
   - `TypeError: client.getRuntimeTaskDetail is not a function`
2. core failed with:
   - `TypeError: service.getRuntimeTaskDetail is not a function`
3. tasks contract failed because the shared manager still lacked:
   - `openRuntimeTaskDetail`
   - `renderRuntimeTaskDetailOverlay`
   - `tasks.page.runtime.taskBoard.detail.*` copy references

### Green

After implementation and locale sync:

1. i18n tests passed
2. foundation checks passed
3. core checks passed
4. task contracts passed
5. production build passed
6. full lint/parity/automation verification passed

## Fix Landed

### 1. Gateway client now exposes detached runtime-task detail

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`

Changes:

1. introduced `OpenClawRuntimeTaskDetailRecord`
2. added `normalizeRuntimeTaskDetail()`
3. added `getRuntimeTaskDetail(instanceId, lookup)` backed by official `tasks.show`
4. preserved the upstream detail fields already used in tests and operator UI

### 2. Shared core service now routes detached runtime-task detail lookups

Updated:

- `packages/sdkwork-claw-core/src/services/taskRuntimeService.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`

Changes:

1. added `getRuntimeTaskDetail` to the shared dependency surface
2. guarded the method behind the same OpenClaw runtime check used by Task Flow detail
3. kept non-OpenClaw runtimes returning `null` instead of leaking unsupported requests

### 3. Runtime task board now has a real detail entrypoint

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. added `openRuntimeTaskDetail()` and `closeRuntimeTaskDetail()`
2. added runtime detail state and overlay rendering
3. added a `Details` button to runtime task cards
4. rendered detached-task operator fields in the overlay:
   - run id
   - source id
   - owner
   - child session
   - requester session when distinct
   - parent task
   - agent
   - flow id
   - delivery status
   - notify policy
   - result
   - cleanup after
   - latest timestamp
   - error
5. reused existing linked-task presentation helpers to keep semantics consistent and the patch
   small

### 4. Locale and contract coverage now lock the surface

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. added dedicated runtime-task detail copy under `tasks.page.runtime.taskBoard.detail`
2. synced compatibility aggregate locale files
3. extended the tasks contract to require:
   - the runtime-task detail entrypoint
   - runtime-task detail overlay rendering
   - dedicated task-board detail locale keys

Implementation note:

- `zh/tasks.json` was updated through controlled JSON parse/serialize instead of manual line-level
  patching because this file is noisy in the terminal and more error-prone to edit blindly

## Verification

Fresh commands run after landing the fix:

```bash
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
node scripts/run-sdkwork-foundation-check.mjs
node scripts/run-sdkwork-core-check.mjs
pnpm.cmd check:sdkwork-tasks
pnpm.cmd build
pnpm.cmd lint
```

Results:

1. locale sync passed
2. i18n tests passed
3. foundation checks passed
4. core checks passed
5. task contracts passed
6. build passed
7. lint passed

Verification feedback:

1. the full lint run again exercised architecture boundaries and parity automation
2. the full parity chain again validated server, desktop, docker, and k8s related checks already
   embedded in this workspace

## Outcome

This loop closes another real OpenClaw parity gap:

1. detached runtime tasks now have a real detail path instead of only a summary board row
2. official `tasks.show` semantics now survive `gateway -> core -> UI`
3. the runtime task board is closer to the upstream operator model without introducing speculative
   extra fields

## Remaining Improvement Opportunities

The next narrow loop should still stay evidence-driven. Strong candidates now are:

1. re-audit whether detached runtime task detail still under-surfaces any upstream-promoted
   operator field compared with the latest `tasks.show`
2. move off the task-runtime surface only if the remaining gaps are no longer material compared
   with upstream operator views
