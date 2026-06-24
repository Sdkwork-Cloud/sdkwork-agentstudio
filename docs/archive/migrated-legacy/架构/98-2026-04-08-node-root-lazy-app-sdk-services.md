# 98-2026-04-08 Node Root Lazy App SDK Services

## Decision

Core services that are published through the Node root entry and depend on app SDK session helpers must load those helpers lazily at call time, not at module evaluation time.

Current services covered by this rule:

- `communityService`
- `dashboardCommerceService`

## Why

- `sdkwork-claw-community` and `sdkwork-claw-dashboard` both consume these services through the package root of `@sdkwork/claw-core`.
- Node-safe test and contract flows import those package roots under `src/node.ts`.
- Before this writeback, both service modules eagerly imported app SDK session helpers from `useAppSdkClient.ts`, so importing the service module pulled browser-oriented SDK wiring into Node evaluation even when tests or feature code supplied explicit dependency overrides.
- The result was a false root-contract failure: the package surface looked correct in browser mode but broke immediately for Node-safe consumers.

## Standard

- Browser-backed default dependency resolution must stay behind lazy `import(...)` boundaries when the service is exported from the Node root surface.
- Node root exports may publish the same service factories and default services as browser consumers, but only after the module is safe to import without an authenticated browser runtime.
- Feature packages must keep consuming `@sdkwork/claw-core` through the package root instead of reaching into package-internal paths to work around Node-safe gaps.

## Impact

- `sdkwork-claw-community` can import `communityService` and `createCommunityService` in Node-safe tests without crashing during module evaluation.
- `sdkwork-claw-dashboard` can import `dashboardCommerceService` and `createEmptyDashboardCommerceSnapshot` through the Node root while still letting tests override commerce APIs explicitly.
- Future root-export drift of this class should be caught as package-surface contract issues instead of surfacing later as runtime import failures.
