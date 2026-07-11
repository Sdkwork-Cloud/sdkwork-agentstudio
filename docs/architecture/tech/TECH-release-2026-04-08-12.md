> Migrated from `docs/release/release-2026-04-08-12.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with a Node-root alignment loop across community, dashboard commerce, and install progress contracts.
- This loop includes two real production contract repairs in `@sdkwork/agentstudio-pc-core` plus targeted test fixture updates.

## Attempt Outcome

- `@sdkwork/agentstudio-pc-core` now publishes `communityService` and `dashboardCommerceService` to Node consumers without eagerly importing app SDK session helpers during module evaluation.
- `sdkwork-agentstudio-pc-community` and `sdkwork-agentstudio-pc-dashboard` service tests now execute cleanly under `node --experimental-strip-types`.
- `installProgressService.test.ts` now matches the current `InstallProgressEvent` contract by including the required base metadata fields.

## Change Scope

- `packages/sdkwork-agentstudio-pc-core/src/services/communityService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/services/dashboardCommerceService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/services/node/index.ts`
- `packages/sdkwork-agentstudio-pc-community/src/services/communityService.test.ts`
- `packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.test.ts`
- `packages/removed-install-feature/src/services/installProgressService.test.ts`
- `docs/review/step-03-community-dashboard-node-root-and-install-progress-alignment-2026-04-08.md`
- `docs/鏋舵瀯/98-2026-04-08-node-root-lazy-app-sdk-services.md`
- `docs/review/step-03-鎵ц鍗?2026-04-07.md`
- `docs/release/release-2026-04-08-12.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-community/src/services/communityService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-core/src/services/dashboardCommerceService.test.ts`
- `node --experimental-strip-types packages/removed-install-feature/src/services/installProgressService.test.ts`

## Risks And Rollback

- The production change is limited to lazy default app SDK resolution and Node root export exposure for two core services.
- Rollback is isolated to the two core service modules, the Node root service index, and the related tests/docs.

