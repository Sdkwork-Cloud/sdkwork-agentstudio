> Migrated from `docs/release/release-2026-04-08-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with an app-store contract loop that removes the current workspace head blocker and keeps the shared `@sdkwork/agentstudio-pc-core` root dependency intact.
- The app-store tests now use real catalog service typing, and the app-store service no longer hard-fails under the Node-safe root entry when callers provide an explicit catalog override.

## Attempt Outcome

- `packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.test.ts` no longer carries the implicit-`any` and stale assessment-issue contract drift that was keeping it at the top of workspace lint.
- `packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.ts` now resolves the default `appStoreCatalogService` lazily from `@sdkwork/agentstudio-pc-core`, which preserves the package-root dependency rule without assuming that the Node-safe runtime entry exports the browser-oriented default value.
- Fresh lint evidence shows the app-store slice is no longer the current blocker; the frontier has advanced to the chat and instances test-contract files.

## Change Scope

- `packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.ts`
- `packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.test.ts`
- `docs/review/step-03-app-store-test-contract-and-node-safe-resolution-2026-04-08.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-07.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts`
- targeted `pnpm.cmd lint` check for `appStoreService.test.ts|appStoreService.ts`

## Risks And Rollback

- This loop changes one production service initialization path, so rollback is isolated to `packages/sdkwork-agentstudio-pc-apps/src/services/appStoreService.ts`.
- The workspace is still red overall, but the app-store test/runtime slice has been removed from the blocker stack with direct evidence.

