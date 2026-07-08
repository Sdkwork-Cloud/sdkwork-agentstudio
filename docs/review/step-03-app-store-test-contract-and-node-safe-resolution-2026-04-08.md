# Step 03 App Store Test Contract And Node-Safe Resolution - 2026-04-08

## 1. Context

- After the previous Step 03 provider/agent loop, the workspace lint frontier moved to `packages/sdkwork-clawstudio-apps/src/services/appStoreService.test.ts`.
- The file had both TypeScript contract drift and a deeper runtime import failure when executed under `node --experimental-strip-types`.

## 2. Root Cause

- The test file was still using `as any` on multiple `appStoreCatalogService` stubs.
  That disabled contextual typing from `createAppStoreService(...)`, so callback parameters such as `params` and `id` fell back to implicit `any`.
- The install-surface assessment fixture still used the older issue shape (`id`, `summary`, `detail`) while the current infrastructure contract now requires `severity`, `code`, and `message`.
- The runtime failure was not another missing `@sdkwork/clawstudio-core` Node export.
  `packages/sdkwork-clawstudio-apps/src/services/appStoreService.ts` was statically importing the value export `appStoreCatalogService` from `@sdkwork/clawstudio-core`, but the Node-safe root entry intentionally does not expose that value.
  Even when tests passed an explicit override, the module crashed during evaluation before the override could be used.

## 3. Changes

- `packages/sdkwork-clawstudio-apps/src/services/appStoreService.test.ts`
  - Removed the `as any` casts from every `appStoreCatalogService` stub so TypeScript can infer the real callback signatures.
  - Updated the stale assessment issue fixture to the current infrastructure contract: `severity`, `code`, `message`.
- `packages/sdkwork-clawstudio-apps/src/services/appStoreService.ts`
  - Replaced the eager default value import with lazy `import('@sdkwork/clawstudio-core')` resolution.
  - Added a resolver that only loads the default `appStoreCatalogService` when no explicit override was supplied.
  - Updated remote catalog, list, and detail reads to resolve the shared catalog service lazily at call time instead of module-init time.

## 4. Verification

| Command | Result | Note |
| --- | --- | --- |
| `node --experimental-strip-types packages/sdkwork-clawstudio-apps/src/services/appStoreService.test.ts` | passed | 18 app-store regression cases stayed green after the test-contract and lazy-resolution updates |
| `node --experimental-strip-types scripts/sdkwork-apps-contract.test.ts` | passed | app-store package contract still enforces `@sdkwork/clawstudio-core` root consumption and installer ownership |
| targeted `pnpm.cmd lint` check for `appStoreService.test.ts|appStoreService.ts` | passed | returned `app-store-clean` |

## 5. Remaining Gaps

- Fresh workspace lint evidence shows the next blocker stack has moved to:
  - `packages/sdkwork-clawstudio-chat/src/services/openClawGatewayHistoryConfigService.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- Step 03 is still not closed.
  This loop only removed the app-store contract/runtime blockers that were at the top of the current lint frontier.
