# OpenClaw i18n False-Alarm Review

## Objective

- Re-check the suspected Chinese locale corruption reported during the OpenClaw parity review.
- Determine whether the problem is real runtime data corruption or only terminal-display noise.
- Preserve the result as a durable regression record before any risky locale rewrite.

## Problem Statement

During the earlier audit loop, raw PowerShell output made several `zh` locale files look corrupted.
That created a serious review risk:

1. we could misdiagnose terminal-encoding noise as product data corruption
2. we could mass-rewrite locale files that were already correct at runtime
3. we could introduce a real regression while trying to fix a false positive

## Review Method

This loop rechecked the problem at the runtime-loaded resource level rather than trusting raw file
display in the shell.

Focus domains:

- `providerCenter`
- `settings`
- `tasks`
- previously added shared usage surface

Primary evidence source:

- `packages/sdkwork-claw-i18n/src/index.test.ts`

## TDD / Regression Guard

The review strengthened the existing i18n contract instead of relying on visual inspection alone.

Added durable assertions for:

1. known-readable Chinese strings in `providerCenter`, `settings`, and `tasks`
2. shared usage-surface strings that were added during earlier OpenClaw parity work
3. a suspicious-pattern scan over the runtime-loaded Chinese strings for those critical domains

This means the workspace now fails fast if those domains ever regress into the previously suspected
mojibake shapes.

## What The New Evidence Shows

Fresh runtime verification proved:

1. `zh.providerCenter.page.title` remains readable
2. `zh.settings.general.title` remains readable
3. `zh.tasks.page.title` remains readable
4. usage-surface Chinese labels also remain readable
5. the suspicious mojibake scan returns an empty result set for the critical domains

Interpretation:

- the runtime-loaded locale objects are healthy
- the earlier concern was a display-layer false alarm caused by terminal encoding behavior

## Files Reinforced

- `packages/sdkwork-claw-i18n/src/index.test.ts`

## Verification

Fresh command run in this loop:

```bash
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
```

Result:

- passed
- critical Chinese feature domains stayed readable
- suspicious mojibake markers were not present in runtime-loaded strings

## Conclusion

The current repository does **not** show evidence of systemic Chinese locale corruption in the
runtime-loaded OpenClaw-aligned translation surface.

Correct classification:

1. product/runtime i18n data: healthy
2. raw PowerShell display of some source files: potentially misleading
3. required action: keep regression coverage, do not perform blind locale rewrites

## Remaining Honest Risk

This result does not prove every future manual locale edit will stay correct. It proves the current
runtime-loaded translation bundles for the reviewed critical domains are correct and now guarded by
tests.
