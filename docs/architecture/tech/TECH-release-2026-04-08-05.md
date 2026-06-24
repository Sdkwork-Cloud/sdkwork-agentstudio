> Migrated from `docs/release/release-2026-04-08-05.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with an install/settings verification loop that removes the last visible `TS2352` test drifts in the current workspace slice.
- The loop also restored the missing Node root export needed by `providerConfigCenterService` so the settings contract can execute through the real `@sdkwork/claw-core` package root under `node --experimental-strip-types`.

## Attempt Outcome

- `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts` now records studio create/update calls with the real `StudioPlatformAPI` input types instead of `Record<string, unknown>` casts.
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts` now records provider-routing saves with the exact `providerRoutingApi.saveProviderRoutingRecord` input type.
- `packages/sdkwork-claw-core/src/services/node/index.ts` now exports `openClawProviderRuntimeConfigService.ts`, closing the Node-only root contract gap that had broken settings tests even after the type cleanup.
- The targeted Step 03 lint scan for those `TS2352` diagnostics is now clean, and both affected regression files execute successfully under `node --experimental-strip-types`.

## Change Scope

- `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `packages/sdkwork-claw-core/src/services/node/index.ts`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/review/step-03-install-settings-test-types-and-core-node-root-2026-04-08.md`
- `docs/release/release-2026-04-08-05.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- targeted `pnpm.cmd lint` scan for the Step 03 `TS2352` diagnostics

## Risks And Rollback

- This iteration intentionally stays narrow: it fixes the concrete install/settings type and root-contract failures without claiming that all workspace lint blockers are resolved.
- The next loop should continue from the next highest real blocker rather than reopening these now-verified test contracts.

