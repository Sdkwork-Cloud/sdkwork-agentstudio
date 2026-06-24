# OpenClaw Task Flow Linked-Task Child-Session Parity

## Objective

- Continue the OpenClaw runtime parity audit with one narrow, verifiable loop.
- Re-check whether local Task Flow linked-task cards surface the same session semantics that
  upstream OpenClaw treats as important public task-run data.
- Land the smallest truthful fix inside the shared task-detail presentation layer without reopening
  broader runtime-board refactors.

## Upstream Review Result

This loop re-read the bundled upstream task sources instead of assuming the remaining linked-task
gap was only about optional metadata.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/auto-reply/reply/commands-subagents/action-info.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`

What upstream currently establishes:

1. `TaskRunView` publicly includes both:
   - `sessionKey`
   - `childSessionKey`
2. upstream task list formatting gives `childSessionKey` first-class visibility as the dedicated
   `Child Session` column
3. upstream task detail output also logs `childSessionKey` explicitly
4. subagent task info uses the child session as the primary `Session:` line when presenting the
   running task context

That means upstream does not treat requester session and execution child session as interchangeable.

## Problem Found

Before this loop, the local linked-task detail cards still collapsed those semantics:

1. the normalized linked-task shape already preserved both `sessionKey` and `childSessionKey`
2. the shared linked-task detail card rendered only:
   - `Session: {task.sessionKey}`
3. when a linked task had a dedicated child execution session, the local UI hid it completely
4. this could mislead operators into reading the requester session as if it were the actual
   execution session

So the remaining gap was not just “one more field”. It was a semantic mix-up between request origin
and execution context.

## Design Decision

Keep this loop narrow:

1. preserve the current linked-task card layout
2. expose `childSessionKey` explicitly with the existing `Child session` locale label
3. keep `Session` only for requester session context
4. suppress the requester-session line when it is identical to the child session so the card does
   not duplicate noise

This keeps the card compact while restoring the upstream meaning of the two session identifiers.

## TDD Record

### Red

Failing tests were added first in two places:

1. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected a helper that hides duplicate requester-session output when it matches the child
     execution session
2. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager to use `task.childSessionKey`, the existing `Child session` locale
     field, and a requester-session helper instead of only printing `task.sessionKey`

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `getTaskFlowLinkedTaskRequesterSession` did not exist
- `pnpm.cmd check:sdkwork-tasks`
  failed for the same missing export, confirming that the shared linked-task presentation layer was
  still missing the session-separation rule

### Green

After the implementation:

- helper tests passed
- shared task contract checks passed
- production build passed
- full workspace lint and parity automation passed

## Fix Landed

### 1. Shared linked-task meta now understands requester-session vs child-session separation

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

Changes:

1. added `getTaskFlowLinkedTaskRequesterSession()`
2. the helper returns:
   - requester session when it is distinct
   - `null` when it duplicates the child execution session

This gives the shared UI one truthful presentation seam instead of repeating ad hoc session logic.

### 2. Linked-task cards now surface the execution child session explicitly

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. linked-task cards now show `Child session`
2. linked-task cards keep `Session` only when requester session still adds separate context
3. duplicate child/requester session values are no longer rendered twice

This aligns the local detail card more closely with upstream task and subagent surfaces.

### 3. Shared task contracts now lock the repaired session semantics

Updated:

- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. require the shared manager to reference `tasks.page.runtime.fields.childSession`
2. require the linked-task presentation path to use `task.childSessionKey`
3. require the linked-task presentation path to use
   `getTaskFlowLinkedTaskRequesterSession()`

That gives future refactors a stable regression tripwire.

## Verification

Fresh commands run in this loop:

```bash
node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts
pnpm.cmd check:sdkwork-tasks
pnpm.cmd build
pnpm.cmd lint
```

Results:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  passed
- `pnpm.cmd check:sdkwork-tasks`
  passed
- `pnpm.cmd build`
  passed
- `pnpm.cmd lint`
  passed

Verification feedback:

1. this loop did not require locale source changes because the existing `Child session` field label
   was already available
2. the full lint run again validated architecture boundaries, OpenClaw parity checks, release
   automation contracts, and multi-mode packaging smoke contracts

## Outcome

This loop closes another real linked-task parity gap:

1. local linked-task cards no longer blur requester session and child execution session
2. the actual execution child session is now visible where upstream operators expect it
3. duplicate session noise is removed when both session identifiers are the same
4. the fix is covered by helper, contract, build, and full lint/parity verification

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. Strong candidates now are:

1. review whether linked-task cards still under-surface `parentTaskId` compared with upstream task
   detail output
2. review whether `cleanupAfter` should be surfaced for linked tasks now that normalization
   already preserves it
3. move to the next OpenClaw module outside task-runtime surfaces once the remaining linked-task
   semantics are exhausted

