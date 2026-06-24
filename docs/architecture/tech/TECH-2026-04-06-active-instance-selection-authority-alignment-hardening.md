> Migrated from `docs/review/2026-04-06-active-instance-selection-authority-alignment-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Active Instance Selection Authority Alignment Hardening

## Problem

The user-visible "set as active instance" affordance was not following the
same truth as the rest of the shell.

Across the application:

- the global `activeInstanceId` store accepts any known instance id
- the shared shell switchers in `sdkwork-claw-shell` and `sdkwork-claw-core`
  already allow selecting any listed instance
- fallback activation also auto-selects `instances[0]` without checking
  `status === 'online'`

But the explicit action entrypoints exposed from the instances feature still
used a stricter local-only rule:

- `packages/sdkwork-claw-instances/src/pages/Instances.tsx`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`

Those pages hid "set as active" whenever `instance.status !== 'online'`.

## Root Cause

This was another authority drift inside the instances layer:

- lifecycle and destructive actions had already started converging on the
  shared `instanceActionCapabilities` service
- active-instance selection still lived as duplicated page-local conditions
- the duplicated logic used raw snapshot status as a gate even though active
  instance selection is a shell context choice, not a lifecycle capability

That created inconsistent user behavior:

- header/sidebar switchers could still select offline or starting instances
- instance cards and detail pages could not
- built-in OpenClaw startup convergence was especially confusing because an
  instance could be shell-selectable in one place but not from its own detail
  surfaces

## Implemented Fix

Implemented contract:

- active-instance selection is available whenever an instance exists
- lifecycle capability remains a separate concern
- instances feature entrypoints must consume the same shared capability source
  instead of repeating page-local status gates

Code changes:

- added `canSetActive` to
  `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts`
- `buildInstanceActionCapabilities(...)` now returns `canSetActive: true` for
  any existing instance and `false` only when no instance exists
- `packages/sdkwork-claw-instances/src/pages/Instances.tsx` now uses
  `actionCapabilities.canSetActive` for both the inline button and the mobile
  dropdown action
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` now uses the
  same shared capability instead of `instance.status === 'online'`

## Regression Coverage

Added and expanded coverage in:

- `packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts`

The regression now freezes these rules:

- built-in instances remain non-deletable but still selectable as the active
  context
- offline instances remain selectable as the active context
- detail-loading failures must not strip active-instance selection capability

## Verification

Executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`

## Outcome

Closed for this slice:

- explicit "set as active" actions no longer disagree with the rest of the
  shell
- instance detail and instance list no longer block selection on stale
  `status === 'online'` snapshots
- active-instance selection is now modeled as a shared capability instead of
  duplicated page-local logic

Still open after this slice:

- launched-session validation for notification, cron, proxy router, and
  instance-detail behavior on top of the aligned active-instance rule
- packaged desktop startup smoke with a live built-in OpenClaw runtime outside
  the current contract/source-test environment

