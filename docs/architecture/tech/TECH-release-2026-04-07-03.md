> Migrated from `docs/release/release-2026-04-07-03.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Switched CI and reusable release workflows to explicit `SDKWORK_SHARED_SDK_MODE=git` so release automation uses pinned GitHub shared SDK refs while local development keeps relative-path workspace sources.
- Added repository-owned shared SDK release source config under `config/shared-sdk-release-sources.json`.
- Replaced generated GitHub release notes with docs-driven notes rendered from `docs/release`.
- Added a `media` channel tab ahead of `all`, with the built-in `sdkworkchat` and `wehcat` entries surfaced as the default media-account channels.
- Hardened shared SDK parity checks so text-only line-ending differences between local Windows checkouts and GitHub release checkouts do not block a valid release.

## Verification Focus

- Confirm the release workflow renders `release-assets/release-notes.md` before calling `softprops/action-gh-release`.
- Confirm the configured GitHub shared SDK refs are synchronized with the local source-of-truth package roots before pushing a release tag.
- Confirm shared SDK parity treats LF and CRLF text sources as equivalent content while still rejecting real content drift.
- Confirm the new `media` tab appears before `all` and the empty-state copy resolves in both English and Chinese locales.

