> Migrated from `docs/review/step-03-openclaw-gateway-history-fixture-alignment-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 OpenClaw Gateway History Fixture Alignment - 2026-04-08

## 1. Context

- After the app-store loop, the next visible workspace lint blocker moved to `packages/sdkwork-claw-chat/src/services/openClawGatewayHistoryConfigService.test.ts`.
- The production service logic was already small and stable.
  The failure came from the test fixture still targeting an older `StudioInstanceDetailRecord` and `OpenClawConfigSnapshot` shape.

## 2. Root Cause

- The detail fixture still used retired instance contract values such as:
  - `deploymentMode: 'managed'`
  - `status: 'running'`
  - `storage.provider: 'filesystem'`
- The nested snapshots were also from an older detail model:
  - `health.checkedAt/message`
  - lifecycle action fields
  - storage path-centric fields
  - connectivity auth/listen-address fields
  - observability metrics/checks fields
  - data-access path fields
- The config snapshot helper also lagged behind the current `OpenClawConfigSnapshot` contract, which now requires `webSearchConfig`, `xSearchConfig`, `webSearchNativeCodexConfig`, `webFetchConfig`, `authCooldownsConfig`, and `dreamingConfig`.

## 3. Changes

- `packages/sdkwork-claw-chat/src/services/openClawGatewayHistoryConfigService.test.ts`
  - Rebuilt the `StudioInstanceDetailRecord` fixture against the current contract:
    - `deploymentMode: 'local-managed'`
    - `status: 'online'`
    - `storage.provider: 'localFile'`
    - current `health`, `lifecycle`, `storage`, `connectivity`, `observability`, and `dataAccess` snapshots
  - Added the missing current `OpenClawConfigSnapshot` sections with minimal defaults.
  - Retyped the snapshot helper to `OpenClawConfigSnapshot['root']` so the test root payload stays aligned with the shared config contract.

## 4. Verification

| Command | Result | Note |
| --- | --- | --- |
| `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/openClawGatewayHistoryConfigService.test.ts` | passed | 3 gateway-history regression cases stayed green after the fixture refresh |
| targeted `pnpm.cmd lint` check for `openClawGatewayHistoryConfigService.test.ts` | passed | returned `openclaw-gateway-history-clean` |

## 5. Remaining Gaps

- Fresh workspace lint evidence shows the next blocker stack has now moved to `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`.
- That next slice is broader than this loop:
  it includes task record contract drift, OpenClaw config snapshot helper drift, and several untyped callback parameters.

