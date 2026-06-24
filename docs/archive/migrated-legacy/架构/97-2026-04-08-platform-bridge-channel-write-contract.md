# 97-2026-04-08 Platform Bridge Channel Write Contract

## Decision

The root studio platform bridge contract must explicitly include the browser workbench channel write operations:

- `setInstanceChannelEnabled`
- `saveInstanceChannelConfig`
- `deleteInstanceChannelConfig`

## Why

- `WebStudioPlatform` already implements these channel write operations.
- `channelService` consumes them through `getPlatformBridge().studio` for browser-hosted workbench flows.
- Before this writeback, `LazyWebStudioPlatform` and the published `StudioPlatformAPI` contract did not expose those methods, so package-local casts hid a real runtime gap until `channelService.test.ts` executed the write path.

## Standard

- Any workbench write capability published by a concrete studio platform must also be published through:
  - the root `StudioPlatformAPI` contract
  - the lazy studio bridge adapter
- Feature packages must keep consuming the root bridge surface, not package-internal platform implementations.
- Platform adapters may leave methods optional when a host genuinely cannot support them, but lazy adapters must forward every capability that the active concrete platform actually implements.

## Impact

- Browser-hosted channel configuration writes now succeed through the default lazy bridge instead of failing with a missing-method error.
- Future contract drift of this class should be caught at the root studio bridge surface instead of surfacing only at runtime in feature services.
