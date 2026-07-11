> Migrated from `docs/release/release-2026-04-07-05.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Materialized the GitHub-backed IM SDK workspace from `Sdkwork-Cloud/sdkwork-im-sdk` and pinned all release-time IM packages to commit `06e92a2e6a2946de05501a4d2785d7e0a4349bb9`.
- Extended shared SDK release-source preparation and parity verification so GitHub release automation now validates `retired generic app SDK package`, `@sdkwork/sdk-common`, `@sdkwork/core-pc-react`, `@sdkwork/im-sdk`, and `@sdkwork/rtc-sdk` together.
- Kept local development on relative workspace paths while ensuring GitHub release builds resolve the same shared SDK content from pinned GitHub refs instead of npm publications.
- Confirmed the channels product surface already keeps the `media` tab before `all`, and that the media-account set includes the default `SDKWORK` public account plus the WeChat public account entry.
- Carried forward every unpublished April 7 release attempt into one publishable release note set.

## Attempt Outcome

- This candidate did not publish a GitHub Release object.
- The `Verify release inputs` job still failed on April 7, 2026 after the IM package roots were materialized.
- Root cause: the TypeScript package scripts inside `Sdkwork-Cloud/sdkwork-im-sdk` still invoked `vite` and `tsc` through hard-coded `../../../node_modules/*` paths, which only worked in one monorepo layout and broke in the Agent Studio release workspace.
- The unpublished change log from this attempt is carried forward into `release-2026-04-07-06`.

## Verification Focus

- Confirm `node scripts/check-shared-sdk-release-parity.mjs` passes for all pinned GitHub-backed shared SDK package roots.
- Confirm `pnpm lint`, `pnpm check:desktop`, `pnpm check:server`, `pnpm build`, `pnpm build:server`, and `pnpm docs:build` succeed from the release-ready workspace.
- Confirm `node scripts/release/render-release-notes.mjs --release-tag release-2026-04-07-05` renders the merged release body and includes the carried-forward tags `release-2026-04-07-01` through `release-2026-04-07-04`.
- Confirm the next release candidate replaces the hard-coded IM package tool paths with portable package-local build metadata and scripts.

