> Migrated from `docs/step/2026-04-07-openclaw-v2026-4-5-runtime-upgrade-readiness.md` on 2026-06-24.
> Owner: SDKWork maintainers

# OpenClaw v2026.4.5 Runtime Upgrade Readiness

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Scope

- Re-check whether the local workspace can honestly upgrade the bundled OpenClaw runtime from
  `2026.4.2` to `v2026.4.5`.
- Record the exact blockers instead of faking parity by changing version strings only.
- Preserve an operator-ready procedure for the next real upgrade attempt.

## Step 1: Upstream baseline re-validation

Review date:

- 2026-04-07

Authoritative upstream baseline already re-validated in the current audit loop:

- GitHub release baseline remains `v2026.4.5`.
- The bundled runtime blocker is therefore not a source-selection problem; it is a local asset
  availability and workspace-readiness problem.

## Step 2: Local bundled runtime source audit

Local version sources still pinned to `2026.4.2`:

- `config/openclaw-release.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
- `packages/sdkwork-claw-desktop/src-tauri/generated/release/openclaw-resource/manifest.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/package/node_modules/openclaw/package.json`
- `.cache/bundled-components/upstreams/openclaw/package.json`

Interpretation:

- The local workspace has not yet imported a real `v2026.4.5` bundled runtime baseline.
- Updating only the version source files would be dishonest because the prepared runtime payload
  and upstream checkout are both still `2026.4.2`.

## Step 3: Upgrade-readiness diagnostic evidence

Command:

```bash
pnpm exec node scripts/openclaw-upgrade-readiness.mjs 2026.4.5
```

Result:

```json
{
  "workspaceRootDir": ".",
  "targetVersion": "2026.4.5",
  "configuredVersion": "2026.4.2",
  "bundledManifestVersion": "2026.4.2",
  "generatedManifestVersion": "2026.4.2",
  "localPreparedRuntimeVersion": "2026.4.2",
  "localUpstreamVersion": "2026.4.2",
  "localUpstreamHasTargetTag": false,
  "localUpstreamDirty": null,
  "localUpstreamDirtyCheck": "unavailable",
  "localTarballPresent": false,
  "readyToUpgrade": false,
  "blockers": [
    "Local bundled OpenClaw upstream checkout is still at 2026.4.2 instead of 2026.4.5.",
    "Local bundled OpenClaw upstream checkout does not contain git tag v2026.4.5.",
    "No local openclaw-2026.4.5.tgz tarball is available for an offline bundled runtime upgrade."
  ]
}
```

Diagnostic feedback:

1. The central configured release version, bundled manifest versions, generated manifest version,
   prepared runtime package version, and local upstream checkout all remain at `2026.4.2`.
2. The local upstream checkout does not yet contain tag `v2026.4.5`, so there is no honest source
   proof that the bundled runtime input was refreshed.
3. No offline `openclaw-2026.4.5.tgz` tarball exists in the workspace root, so the current
   workspace cannot complete the upgrade without additional real assets.
4. `localUpstreamDirtyCheck` is currently reported as `unavailable` because Node child-process
   spawning is sandbox-blocked in this environment.

## Step 4: Dirty upstream checkout evidence outside the Node sandbox

Command:

```bash
git -C .cache/bundled-components/upstreams/openclaw status --short
```

Result:

```text
 M src/agents/skills.test-helpers.ts
 M src/agents/skills/local-loader.ts
```

Interpretation:

- The local upstream checkout is dirty even though the Node readiness script cannot report it
  directly under this sandbox.
- That means a future operator must not solve the version drift by hard-resetting the upstream clone
  in place without first preserving or intentionally discarding those local changes.

## Step 5: Current blocker conclusion

The bundled runtime upgrade to `v2026.4.5` is not honestly landable in the current workspace state.

Real blockers:

1. The bundled upstream checkout is still on `2026.4.2`.
2. The local upstream checkout does not contain tag `v2026.4.5`.
3. No offline `openclaw-2026.4.5.tgz` tarball is present.
4. The upstream checkout also contains uncommitted local changes that must be handled safely before
   any refresh.

Decisions locked in for this loop:

1. Do not edit `config/openclaw-release.json` to `2026.4.5` yet.
2. Do not mutate bundled desktop manifests to claim `2026.4.5` yet.
3. Do not hard-reset `.cache/bundled-components/upstreams/openclaw` in place while it is dirty.

## Step 6: Recommended operator procedure for the next real upgrade attempt

When real `v2026.4.5` inputs are available, use this order:

1. Preserve or intentionally resolve the dirty files in
   `.cache/bundled-components/upstreams/openclaw`.
2. Refresh the local upstream checkout so `package.json` reports `2026.4.5` and git tag
   `v2026.4.5` exists locally.
3. Stage a real offline `openclaw-2026.4.5.tgz` tarball when the upgrade path depends on tarball
   packaging.
4. Re-run:
   - `pnpm exec node scripts/openclaw-upgrade-readiness.mjs 2026.4.5`
   - `pnpm check:desktop-openclaw-runtime`
5. Only after the readiness gate is green, update the central release source and regenerate the
   bundled manifests:
   - `config/openclaw-release.json`
   - prepared runtime payload
   - generated release manifest outputs
6. Re-run the post-upgrade verification batch:
   - `pnpm check:desktop-openclaw-runtime`
   - `pnpm check:desktop`
   - `pnpm check:release-flow`
   - `pnpm build`
   - `pnpm check:server`

## Net result

This loop did not upgrade the bundled OpenClaw runtime, by design.

It did improve the repository in two ways:

1. The blocker is now documented with executable evidence instead of being left as a vague parity
   note.
2. The next upgrade attempt now has an explicit readiness gate and an ordered operator procedure,
   which reduces the risk of shipping a fake version bump or damaging the dirty upstream checkout.

