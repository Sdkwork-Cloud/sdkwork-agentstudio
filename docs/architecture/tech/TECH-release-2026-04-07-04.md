> Migrated from `docs/release/release-2026-04-07-04.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Published `@sdkwork/core-pc-react` to the new independent GitHub repository `Sdkwork-Cloud/sdkwork-core` and pinned the release workflow to commit `b30bab1f67a696e903a753000282018ace673e13`.
- Synchronized `retired generic app SDK package` with the current local source-of-truth workspace and advanced the release pin to commit `e7bc761ce45acf142721b96f732b361c77a71e73`.
- Extended shared SDK release-source preparation and parity verification so GitHub release automation now validates `retired generic app SDK package`, `@sdkwork/sdk-common`, and `@sdkwork/core-pc-react` together.
- Kept local development on relative workspace paths while ensuring GitHub release builds resolve the same package content from pinned GitHub refs.
- Carried forward all unpublished April 7 release attempts into one release note set so the first successful GitHub release captures the full change log.

## Attempt Outcome

- This candidate did not publish a GitHub Release object.
- The `Verify release inputs` job failed on April 7, 2026 because the GitHub-backed release workspace still did not materialize the IM SDK packages required by `@sdkwork/core-pc-react`.
- The missing packages were:
  - `@sdkwork/im-sdk`
  - `@sdkwork/rtc-sdk`
- The unpublished change log from this attempt is carried forward into `release-2026-04-07-05`.

## Verification Focus

- Confirm `node scripts/check-shared-sdk-release-parity.mjs` passes against the pinned GitHub refs for all three shared packages.
- Confirm `pnpm lint`, `pnpm check:desktop`, `pnpm check:server`, `pnpm build`, `pnpm build:server`, and `pnpm docs:build` succeed in release mode with the GitHub-backed shared SDK sources.
- Confirm the reusable release workflow can now resolve `@sdkwork/core-pc-react/app`, `@sdkwork/core-pc-react/env`, and `@sdkwork/core-pc-react/runtime` during `pnpm lint`.
- Confirm the rendered GitHub release body carries forward `release-2026-04-07-01`, `release-2026-04-07-02`, and `release-2026-04-07-03`.

