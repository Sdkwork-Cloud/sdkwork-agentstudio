> Migrated from `docs/release/release-2026-04-07-01.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Added the reusable GitHub release workflow permission fix so release tags can request `packages: write` without failing during workflow bootstrap.
- Strengthened the release workflow contract tests so permission regressions are caught locally before a tag is pushed.

## Failure Record

- The workflow did not start packaging work because the caller workflow permission surface was narrower than the reusable workflow requirement.
- No GitHub release was created for this tag.

