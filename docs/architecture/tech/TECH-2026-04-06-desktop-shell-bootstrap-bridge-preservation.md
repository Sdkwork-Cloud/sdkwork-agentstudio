> Migrated from `docs/review/2026-04-06-desktop-shell-bootstrap-bridge-preservation.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Shell Bootstrap Bridge Preservation

## Problem

The previous desktop startup hardening fixed one concrete call site in
`packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.ts`:
when the active platform is `desktop`, the shared shell bootstrap no longer
installs the hosted-browser bridge.

That removed the immediate startup overwrite, but the lower infrastructure entry
points in
`packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
still accepted direct calls while the desktop bridge was already active.

That meant the architecture was still vulnerable to the same class of bug:

- desktop boot configures the authoritative Tauri/desktop bridge first
- a later shared/browser-oriented caller invokes
  `configureServerBrowserPlatformBridge(...)` or
  `bootstrapServerBrowserPlatformBridge(...)`
- the hosted-browser bridge overwrites `manage`, `internal`, `runtime`, and
  `studio` surfaces even though `platform.getPlatform()` is already `desktop`

The result is host-authority drift. Desktop startup may pass, but later calls
can still push the app back onto hosted-browser surfaces and reintroduce the
same family of CORS, browserBaseUrl, and hosted-path mismatches.

## Root Cause

The bug was not only in shell bootstrap ordering.

The deeper root cause was that the hosted-browser bridge installer itself had no
desktop-authority compatibility gate. It only checked whether hosted metadata or
the structured bootstrap descriptor existed. It did not check whether the
current active bridge was already the desktop authority.

This left the architecture dependent on every caller "doing the right thing"
instead of making the shared installer safe by construction.

## Changes

### 1. Preserve desktop authority inside the shared installer

`packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts`
now checks the active platform bridge before installing hosted-browser
surfaces.

If `getPlatformBridge().platform.getPlatform() === 'desktop'`:

- `configureServerBrowserPlatformBridge(...)` returns `false`
- `bootstrapServerBrowserPlatformBridge(...)` returns `false`
- no hosted-browser `manage/internal/runtime/studio` surfaces are installed
- structured bootstrap descriptor fetches are skipped entirely

This closes the overwrite path at the infrastructure boundary instead of
relying only on higher-level call-site discipline.

### 2. Add explicit regression coverage

`packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`
now locks two critical behaviors:

- direct hosted-browser bridge configuration must not replace the active
  desktop authority
- structured bootstrap descriptor loading must not run while desktop authority
  is already active

### 3. Move infrastructure source tests into the standard verification path

The workspace previously ran only the string-level foundation contract test.
The source-level infrastructure platform tests were not part of the standard
`check:sdkwork-foundation` gate.

This iteration adds:

- `scripts/run-sdkwork-foundation-check.mjs`

and updates:

- `package.json`

so `check:sdkwork-foundation` now executes:

- `packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `scripts/sdkwork-foundation-contract.test.ts`

That makes future bridge-authority regressions much harder to reintroduce
silently.

## Verification

Executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts']))"`
- `node scripts/run-sdkwork-foundation-check.mjs`
- `pnpm.cmd check:sdkwork-foundation`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd check:desktop`

## Outcome

Closed for this slice:

- shell bootstrap no longer reinstalls the hosted-browser bridge on desktop
- shared hosted-browser bridge installers no longer override active desktop
  authority
- direct structured bootstrap descriptor fetches are skipped once desktop
  authority is active
- foundation verification now includes real infrastructure source tests instead
  of only contract-string checks

Still open after this slice:

- launched-session validation for chat, notification, cron, proxy router, and
  instance detail on top of the now-fully preserved desktop authority
- packaged installer smoke on real Windows/Linux/macOS environments
- remaining renderer/browser fallback review where data normalization, not
  bridge installation, could still drift from host-published truth

