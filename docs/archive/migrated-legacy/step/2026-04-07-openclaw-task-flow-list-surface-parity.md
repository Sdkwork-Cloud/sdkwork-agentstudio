# OpenClaw Task Flow List-Surface Parity

## Objective

- Continue the OpenClaw `2026.4.2` upgrade review with a focused audit on `tasks / task flow`.
- Compare the current Studio task-flow board against the latest upstream public task-flow surfaces.
- Land the smallest real fix that improves parity without inventing unsupported detail data.

## Upstream Review Result

This loop rechecked the latest bundled OpenClaw sources instead of assuming the current Studio
board was merely "missing some labels."

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`
- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/runtime-tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/flows.ts`
- `.cache/bundled-components/upstreams/openclaw/CHANGELOG.md`

What the latest public surface actually shows:

1. `tasks.flow.list` is aligned to the canonical `TaskFlowView` shape
2. that view treats `goal`, `currentStep`, `notifyPolicy`, `cancelRequestedAt`, `ownerKey`, and
   flow `status` as first-class public semantics
3. richer `state / wait / blocked / tasks / taskSummary` data belongs to the detail surface
   (`TaskFlowDetail`) or CLI inspection paths such as `flows show`

That distinction mattered.

The local Studio board already had a task-flow panel, but it mostly preserved thinner or older
fields like:

- `syncMode`
- `revision`
- `taskCount`
- `activeTaskCount`
- `summary`

The real parity gap was that the current app dropped most of the latest canonical list-surface
meaning:

- `goal`
- `currentStep`
- `notifyPolicy`
- `cancelRequestedAt`
- `ownerKey`

There was also a smaller behavioral mismatch:

- the local "active task flows" count did not treat `waiting` as active pressure

## Architecture Problem Found

Before this loop, the current architecture had an asymmetry:

1. the gateway client already called the official `tasks.flow.list` surface
2. the task-flow UI already existed
3. but the normalization layer removed the most important list-surface semantics before the UI ever
   saw them

That meant the board could only emphasize partial or legacy-feeling metadata, while the upstream
public surface had already shifted toward:

- orchestration goal
- current step
- cancel intent
- owner/context
- notification policy

So the problem was not "task flow missing entirely." The problem was semantic loss across the
`gateway -> core -> UI` boundary.

## TDD Record

### Red

First, the gateway regression test was tightened in
`packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`.

The updated test expected the official task-flow list surface to preserve:

- `ownerKey`
- `notifyPolicy`
- `goal`
- `currentStep`
- `cancelRequestedAt`
- `createdAt -> startedAt`

Fresh red result:

- `node scripts/run-sdkwork-foundation-check.mjs`
- failed only on `listTaskFlows uses the latest tasks.flow.list gateway surface and normalizes recent flow metadata`

That failure proved the gap was real and specifically inside task-flow normalization.

For the UI-side behavior, a second focused red/green cycle added pure tests in
`packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts` for:

- preferring `goal` over thin summary text
- avoiding misleading `0/0` activity output when upstream counts are absent
- treating `waiting` as active task-flow pressure

### Green

After the fix:

- the gateway normalization test passed
- the new task-flow UI helper tests passed
- the expanded `check:sdkwork-tasks` gate passed

## Fix Landed

### 1. Gateway normalization now preserves the latest list-surface fields

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`

`OpenClawTaskFlowRecord` now preserves:

- `ownerKey`
- `notifyPolicy`
- `goal`
- `currentStep`
- `cancelRequestedAt`

The normalizer also now derives task counts from `taskSummary` when available, instead of assuming
only the old `taskCount` fields exist.

### 2. Task-flow board now renders the public orchestration semantics

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`

Behavior changes:

1. flow cards now prefer `goal` as the main summary
2. cards expose `currentStep`, `notifyPolicy`, `owner`, and `cancelRequestedAt`
3. active counters now treat `waiting` as active runtime pressure
4. activity display no longer lies with an automatic `0/0` when upstream counts are absent

### 3. Tasks verification now includes real commons-layer tests

Added:

- `scripts/run-sdkwork-tasks-check.mjs`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

Updated:

- `packages/sdkwork-claw-commons/src/components/cronTasksManagerData.test.ts`
- `scripts/sdkwork-tasks-contract.test.ts`
- `package.json`

`pnpm check:sdkwork-tasks` now runs:

1. commons data/helper tests
2. task feature contract checks

This closes a real verification gap: those commons task-runtime helpers were previously not covered
by the standard tasks gate.

### 4. Locale copy and compatibility aggregates were synchronized

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

New runtime task-flow labels were added for:

- `currentStep`
- `notifyPolicy`
- `owner`
- `cancelRequestedAt`

Process note:

- the first compatibility sync failed because a PowerShell rewrite introduced a UTF-8 BOM into
  `zh/tasks.json`
- the file was immediately rewritten as UTF-8 without BOM
- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales` then passed

## Files Updated In This Loop

- `package.json`
- `scripts/run-sdkwork-tasks-check.mjs`
- `scripts/sdkwork-tasks-contract.test.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `packages/sdkwork-claw-commons/src/components/cronTasksManagerData.test.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

## Verification

Fresh commands run in this loop:

```bash
node scripts/run-sdkwork-foundation-check.mjs
pnpm.cmd check:sdkwork-tasks
node scripts/run-sdkwork-core-check.mjs
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
pnpm.cmd build
```

Results:

- foundation check: passed
- tasks check: passed
- core check: passed
- i18n runtime/index test: passed
- locale compatibility sync: passed
- production web build: passed

## Honest Remaining Gap

This loop intentionally stopped at the official list surface.

Still not wired into Studio:

1. `tasks.flow.show` detail inspection
2. explicit display of upstream detail-only data such as:
   - `state`
   - `wait`
   - `blocked`
   - linked `tasks`
   - canonical `taskSummary`

That is the next best task-flow audit target.

The important boundary is now clear:

- current Studio list board is aligned with the latest public list-surface semantics
- full task-flow detail/recovery inspection still needs a dedicated `show`-surface integration

## Net Result

This loop materially improved OpenClaw parity:

1. the task-flow board now reflects the latest upstream list-surface meaning instead of dropping it
2. active flow pressure is counted more honestly because `waiting` is no longer ignored
3. task-runtime UI behavior is now covered by the standard tasks verification gate
4. locale and compatibility resources were synchronized and revalidated
5. the next gap is narrower and clearer: integrate `tasks.flow.show` detail inspection instead of
   guessing detail data from `tasks.flow.list`
