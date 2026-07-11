> Migrated from `docs/review/2026-04-06-desktop-hosted-runtime-websocket-dialability-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Hosted Runtime WebSocket Dialability Hardening

## Scope

This slice closes the next desktop hosted-runtime truth gap:

- the embedded-host readiness probe already checked lifecycle, endpoint
  projection, managed gateway projection, built-in instance projection, and
  gateway invoke capability
- but it still treated `gatewayWebsocketReady` as "metadata exists" instead of
  "the published WebSocket can actually be dialed"

That left one concrete failure mode open:

- desktop bootstrap could pass
- chat/config/runtime consumers could immediately attempt the managed OpenClaw
  WebSocket
- the browser then failed with `ERR_CONNECTION_REFUSED` because the socket was
  not actually accepting connections yet

## Root Cause

The bug was in
`packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`.

Readiness previously derived websocket success from:

- `openClawGatewayReady`
- `Boolean(openClawGatewayWebsocketUrl)`

That only proved the host had published websocket metadata. It did **not**
prove the managed OpenClaw gateway was already listening on the published URL.

In other words, the bridge was still accepting a metadata-only condition for a
transport that is fundamentally connection-oriented.

## Fix

Implemented changes:

- added explicit websocket probe support to
  `probeDesktopHostedRuntimeReadiness(...)`
- extended readiness evidence with:
  - `gatewayWebsocketProbeSupported`
  - `gatewayWebsocketDialable`
- added `probeDesktopHostedGatewayWebSocketDialability(...)` so readiness can
  perform a short real dial against the published managed OpenClaw websocket
- changed readiness enforcement so a failed dial now flips `ready` to `false`
  and throws:
  - `Desktop hosted runtime did not accept a WebSocket connection on the managed OpenClaw gateway yet.`

Deliberate architecture choice:

- websocket dialability probing is **opt-in by explicit injection**
- `desktopHostedBridge.ts` does **not** silently fall back to
  `globalThis.WebSocket`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts` is the place that
  injects the real browser `WebSocket` for live desktop startup

That keeps Node-based contract tests deterministic while still making live
desktop startup depend on actual websocket reachability.

## Regression Coverage

Added and updated coverage:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
  now proves:
  - readiness succeeds when the injected WebSocket probe opens
  - readiness rejects when the injected WebSocket probe errors
- `scripts/sdkwork-host-runtime-contract.test.ts` now locks:
  - the new readiness evidence fields
  - the explicit websocket-dialability readiness failure message
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts` is contract-locked
  to inject the browser `WebSocket` only at the real desktop runtime boundary

## Files Changed

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`
- `scripts/sdkwork-host-runtime-contract.test.ts`

## Verification

Executed and passed:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

## Remaining Risk

This slice closes bootstrap-time websocket dialability truth, not every
post-startup authority path.

Still open:

- browser-only fallback review in
  `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts` if any UI
  flow can still override canonical host-published managed runtime metadata
- launched-session validation for chat, notification, cron, proxy router, and
  instance detail on top of the stricter websocket-dialability gate
- packaged installer smoke on real Windows/Linux/macOS environments outside the
  current synthetic release checks

