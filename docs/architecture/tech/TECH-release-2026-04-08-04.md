> Migrated from `docs/release/release-2026-04-08-04.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with a market-service Node-safe pass that removes eager `@sdkwork/agentstudio-pc-instances` root loading from `mySkillService` when callers already inject explicit dependencies.
- The market package now uses the same root-consumption pattern on both shared backends:
  - `marketService` lazily resolves `@sdkwork/agentstudio-pc-core`
  - `mySkillService` lazily resolves `@sdkwork/agentstudio-pc-instances`
- Local market tests were also tightened to use real input types, eliminating the package-local `TS2352` casts that had been masking the actual next workspace blockers.

## Attempt Outcome

- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.ts` now resolves default workbench and skill-management services through dynamic root imports only when needed.
- `scripts/sdkwork-market-contract.test.ts` was updated to treat dynamic root imports as valid for `mySkillService`, matching the runtime-safe implementation.
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.test.ts` and `mySkillService.test.ts` now record calls with concrete input types instead of `Record<string, unknown>` casts.
- Follow-up probing on `sdkwork-agentstudio-pc-instances` moved that contract path forward to a later dependency assertion, which is now the next separate blocker.

## Change Scope

- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.test.ts`
- `scripts/sdkwork-market-contract.test.ts`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/review/step-03-market-myskill-node-safe-defaults-2026-04-08.md`
- `docs/release/release-2026-04-08-04.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-market-contract.test.ts`
- `pnpm.cmd check:sdkwork-market`

## Risks And Rollback

- This iteration closes the eager default-service loading issue in `mySkillService`, but it does not claim that `@sdkwork/agentstudio-pc-instances` is fully Node-safe across every root consumer.
- The next visible blockers are outside the market package and should be handled as separate loops rather than by rolling back the now-verified lazy import pattern.

