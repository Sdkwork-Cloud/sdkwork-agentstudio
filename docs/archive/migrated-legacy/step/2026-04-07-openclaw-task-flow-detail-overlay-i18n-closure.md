# OpenClaw Task Flow Detail Overlay I18n Closure

## Objective

- Continue the OpenClaw Task Flow audit with one more narrow loop after detail-surface parity.
- Remove the remaining hard-coded English copy from the new Task Flow detail overlay.
- Make the upgraded `tasks.flow.show` inspection surface truthful in multi-language mode too.

## Problem Found

The previous loop landed the official `tasks.flow.show` data path and a usable detail overlay, but
the overlay still contained hard-coded English copy inside `CronTasksManager`.

The runtime task board itself already used `tasks` locale resources. The new overlay did not.

That created a localized architecture gap:

1. data parity with upstream was correct
2. the shared task UI still rendered part of the upgraded feature in English only
3. Chinese mode therefore showed a mixed-language detail surface

This was not a protocol problem. It was a presentation truthfulness problem.

## Review Scope

Files reviewed before the fix:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Hard-coded overlay copy found during the scan included:

- detail description
- payload summary label
- task summary label
- blocked / wait / state labels
- state payload / wait payload section titles
- linked task section title and description
- linked task empty state
- linked task field labels for session / agent / error
- unavailable / load-failed fallback copy

## TDD Record

### Red

The task contract was tightened first in:

- `scripts/sdkwork-tasks-contract.test.ts`

The updated contract required:

1. `CronTasksManager` to reference `tasks.page.runtime.detail.*` translation keys
2. `en.json` and `zh.json` compatibility aggregates to expose the new detail keys

Fresh red result:

```bash
pnpm.cmd check:sdkwork-tasks
```

It failed specifically on:

- missing `tasks.page.runtime.detail.description` usage in
  `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

That failure confirmed the remaining gap was real and not hypothetical.

### Green

After wiring the new locale keys and syncing compatibility aggregates:

```bash
pnpm.cmd check:sdkwork-tasks
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
```

All passed.

## Fix Landed

### 1. The Task Flow detail overlay now uses locale resources end to end

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

The overlay now routes the following through translation keys instead of hard-coded English:

- detail description
- payload summary label
- task summary / blocked / wait / state labels
- payload section titles
- linked task section labels
- unavailable / load-failed fallback copy

### 2. New runtime detail locale keys were added

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`

New keys live under:

- `tasks.page.runtime.detail`

Added entries:

- `description`
- `payloadSummary`
- `taskSummary`
- `blocked`
- `wait`
- `state`
- `statePayload`
- `waitPayload`
- `linkedTasksTitle`
- `linkedTasksDescription`
- `linkedTasksEmpty`
- `session`
- `agent`
- `error`
- `unavailable`
- `loadFailed`

### 3. Compatibility locale aggregates were refreshed

Refreshed via:

```bash
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
```

This updated:

- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

### 4. The task contract now guards the upgraded localized surface

Updated:

- `scripts/sdkwork-tasks-contract.test.ts`

The contract now verifies both:

1. the shared task manager uses `tasks.page.runtime.detail.*` keys
2. both compatibility locale aggregates expose those keys

That means a future regression back to hard-coded overlay copy will fail automatically.

## Verification

Fresh commands run in this loop:

```bash
pnpm.cmd check:sdkwork-tasks
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd build
```

Results:

- `pnpm.cmd check:sdkwork-tasks`
  passed
- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  passed
- `pnpm.cmd build`
  still failed for the same external environment reason:
  - `ENOSPC: no space left on device`

Additional review check:

- a focused source scan for the previous hard-coded English overlay phrases returned no matches in
  `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

## Files Updated In This Loop

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

## Outcome

This loop closes the most obvious remaining quality gap in the new Task Flow detail UI:

- protocol parity was already landed
- shared task UI is now localized consistently
- compatibility aggregates and contract checks now enforce that consistency

## Remaining Improvement Opportunities

The next narrow loop should target one of these:

1. add a render-level regression test for the Task Flow detail overlay itself
2. re-run full production build after disk space is recovered
3. continue upstream audit on the next highest-signal OpenClaw feature area instead of broad
   refactoring
