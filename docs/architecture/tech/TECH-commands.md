> Migrated from `docs/reference/commands.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Commands

## Workspace Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm dev` | Start the web development server |
| `pnpm build` | Build the web package |
| `pnpm preview` | Preview the built web package |
| `pnpm lint` | Run TypeScript, architecture, and parity checks |
| `pnpm clean` | Clean the web package build output |

## Architecture And Parity

| Command | Purpose |
| --- | --- |
| `pnpm check:arch` | Validate package boundaries, structure, and root-only imports |
| `pnpm check:parity` | Run focused parity checks against critical `upgrade/claw-studio-v5` behavior |
| `pnpm sync:features` | Sync feature package wiring helpers maintained by repository scripts |

## Desktop Commands

| Command | Purpose |
| --- | --- |
| `pnpm tauri:dev` | Run the desktop shell and launch Tauri |
| `pnpm tauri:build` | Build desktop installers and bundles |
| `pnpm tauri:icon` | Regenerate desktop app icons from the source asset |
| `pnpm tauri:info` | Print Tauri environment information |
| `pnpm check:desktop` | Validate desktop runtime and command contracts |
| `pnpm check:desktop-openclaw-runtime` | Validate bundled OpenClaw runtime readiness, packaging metadata, and release-asset contracts |
| `pnpm release:desktop` | Run the desktop release build entry used by CI |
| `pnpm release:package:desktop` | Collect already-built desktop installers and checksum files into `artifacts/release`; run `pnpm release:desktop` or `pnpm tauri:build` first |
| `pnpm release:package:web` | Rebuild, archive, checksum, and smoke real web/docs assets into `artifacts/release` |

## Server And Deployment Commands

| Command | Purpose |
| --- | --- |
| `pnpm server:dev` | Run the native Rust server host in development mode |
| `pnpm server:build` | Build the native Rust server binary in release mode; append `-- --target <triple>` for an explicit release target. Windows hosts automatically route Linux targets through WSL when an installed distro is available |
| `pnpm check:multi-mode` | Run the highest-signal local gate across desktop, server, unified host runtime, OpenClaw readiness, and release packaging contracts |
| `pnpm check:server` | Validate server package structure and run native Rust server tests |
| `pnpm check:sdkwork-host-runtime` | Validate the unified runtime authority and smoke contracts that span desktop, server, docker, and kubernetes ownership boundaries |
| `pnpm release:plan` | Resolve the current multi-family release plan and emit machine-readable target matrices plus `requiredTargetCount` and `familyTargetCounts` as the release target-count authority |
| `pnpm release:status` | Inspect the active release asset directory without finalizing it, read existing partial `release-asset-manifest.json` files, report top-level `status` (`complete`, `partial`, or `invalid`), `issueCount`, `blockingIssueCount`, `hasIssues`, `hasBlockingIssues`, `issueCountsBySeverity`, `issueCountsByCode`, `releaseCoverage`, `presentTargetCount`, `missingTargetCount`, `requiredTargetCount`, manifest/profile/path issues with `severity`, `blocking`, and `recommendedAction`, target-specific `nextCommands`, and prioritized `nextActions` with `fix-issue` actions before `package-target` actions via numeric `priority`; top-level `status=invalid` means structural issues exist even when `releaseCoverage.status=complete`; unlike `release:assert-ready`, a missing or partial `artifacts/release` directory is reported as machine-readable status instead of a failed publish gate |
| `pnpm release:package:server` | Package a native server archive into `artifacts/release`; the local wrapper refreshes the matching target server binary through an incremental build before packaging |
| `pnpm release:package:container` | Package Docker deployment bundles into `artifacts/release`; the local wrapper refreshes the matching Linux server binary through an incremental build before packaging. On Windows that build can reuse WSL automatically |
| `pnpm release:package:kubernetes` | Package Helm-compatible deployment bundles into `artifacts/release`; packages chart assets without building a server binary |
| `pnpm release:smoke:desktop` | Re-run packaged desktop installer smoke and launched-session startup smoke for an existing packaged desktop target; pre-validates the packaged OpenClaw `runtime.zip` and macOS `.app.zip`/`.app.tar.gz` companion archive entries so absolute paths, `..` traversal, duplicate normalized paths, encrypted ZIP entries, symlinks, hardlinks, devices, pipes, and other non-regular archive entries cannot reach first-launch extraction or installer smoke metadata |
| `pnpm release:smoke:desktop-packaged-launch` | Launch the canonical packaged desktop artifact for one target and capture isolated packaged-session startup evidence |
| `pnpm release:smoke:desktop-startup` | Validate captured packaged desktop startup evidence and emit the canonical desktop startup smoke report; rejects unsafe or non-canonical artifact and captured evidence paths before writing report metadata |
| `pnpm release:smoke:server` | Re-run packaged server bundle smoke for an existing packaged server artifact set; rejects unsafe or non-canonical artifact and launcher paths before writing `release-smoke-report.json`, and pre-validates `.tar.gz`/`.zip` archive entries before extraction so absolute paths, `..` traversal, duplicate normalized paths, symlinks, hardlinks, devices, pipes, and other non-regular archive entries cannot reach the extractor |
| `pnpm release:smoke:web` | Re-run packaged Web/docs archive smoke for an existing web artifact set; rejects unsafe or non-canonical artifact paths before writing `release-smoke-report.json`, and rejects archive-internal absolute paths, `..` traversal, duplicate normalized paths, symlinks, hardlinks, devices, pipes, and other non-regular entries while reading the packaged Web/docs `.tar.gz` |
| `pnpm release:smoke:container` | Re-run packaged Docker deployment smoke for an existing container release bundle; rejects unsafe or non-canonical artifact and launcher paths before writing `release-smoke-report.json`, and pre-validates archive entries before extraction so unsafe paths, duplicate normalized paths, symlinks, hardlinks, devices, pipes, and other non-regular archive entries cannot reach the extractor |
| `pnpm release:smoke:kubernetes` | Re-run packaged chart rendering and readiness smoke for an existing kubernetes release bundle; rejects unsafe or non-canonical artifact and launcher paths before writing `release-smoke-report.json`, and pre-validates archive entries before extraction so unsafe paths, duplicate normalized paths, symlinks, hardlinks, devices, pipes, and other non-regular archive entries cannot reach the extractor |
| `pnpm release:finalize` | Strictly merge family manifests, require pre-rendered `release-notes.md`, record it under top-level `releaseMetadata`, reject wrong-profile partial manifests, revalidate unsafe or non-canonical artifact, launcher, and captured evidence paths through the shared smoke path contract, reject artifacts outside the active release profile, reject duplicate artifacts for the same release target, remove stale top-level `release-manifest.json`, `release-manifest.json.sha256.txt`, `release-attestations.json`, and `SHA256SUMS.txt`, remove per-artifact packaging checksum sidecars after writing the authoritative `SHA256SUMS.txt`, compute top-level checksums for artifacts plus release metadata, emit `release-manifest.json`, and bind it with `release-manifest.json.sha256.txt` only when every release-profile target is present; the manifest records `releaseCoverage`, `releaseMetadata`, `attestationEvidenceFileName`, and `attestationPredicateType`, the active directory defaults to `artifacts/release` locally, and the wrapper resolves `repository` from `SDKWORK_RELEASE_REPOSITORY`, then `GITHUB_REPOSITORY`, then `git remote origin` |
| `pnpm release:write-attestation-evidence` | CI/local provenance evidence helper that reads finalized `release-manifest.json`, runs `gh attestation verify` for every manifest artifact and release metadata subject, including `release-notes.md`, against the release repository, `refs/tags/<releaseTag>`, the SLSA provenance predicate, and `--signer-workflow <owner/repo/.github/workflows/release-reusable.yml>`, rejects verification output that does not bind the expected digest, and writes `release-attestations.json` with `signerWorkflowIdentity` for the final readiness gate |
| `pnpm release:assert-ready` | Verify `release-manifest.json.sha256.txt` against `release-manifest.json` before parsing, re-read the finalized `release-manifest.json`, `release-attestations.json`, and `SHA256SUMS.txt`, reject partial coverage, reject manifests created with `--allow-partial-release`, reject artifacts outside the active release profile, reject duplicate artifacts for the same release target, independently revalidate every finalized `.tar.gz` and `.zip` artifact, including macOS `.app.zip` and `.app.tar.gz` desktop app companion archives, so unsafe paths, duplicate normalized paths, symlinks, hardlinks, devices, pipes, and other non-regular archive entries cannot be published, verify every listed artifact and `releaseMetadata` checksum and size, require `release-notes.md` to remain covered by `releaseMetadata`, `SHA256SUMS.txt`, and `release-attestations.json`, require every release subject to have verified attestation evidence bound to the same relative path, sha256, repository, release tag, source ref, predicate type, signer workflow, and signer workflow identity, require the recorded `gh attestation verify` command to include `--signer-workflow`, require each artifact to retain its family-specific smoke metadata (`desktopInstallerSmoke`, `desktopStartupSmoke`, `webArchiveSmoke`, `serverBundleSmoke`, or `deploymentSmoke`) with `reportRelativePath`, `manifestRelativePath`, and desktop `capturedEvidenceRelativePath` evidence files still present, still matching their recorded sha256/size bindings, and still matching the referenced smoke report contents, reject any file under the release asset directory that is not declared by the finalized manifest, and reject symlinks, junctions, devices, pipes, or other non-regular release directory entries before publishing |
| `pnpm release:fixture:ready` | Generate a synthetic but complete finalized release asset directory under `artifacts/release-readiness-fixture` for the default `claw-studio` profile, including all 25 required Web, desktop, server, container, and kubernetes targets, cross-check the required target count against `release:plan.requiredTargetCount`, emit `release-notes.md`, `SHA256SUMS.txt`, `release-manifest.json`, `release-manifest.json.sha256.txt`, `release-attestations.json`, and hash-bound smoke evidence, then immediately run the real `release:assert-ready` gate against that fixture; mainline CI runs this command as the final readiness success-path proof |
| `pnpm release:finalize:partial` | Explicit local/debug aggregation for incomplete release asset directories; passes `--allow-partial-release` and marks `release-manifest.json.releaseCoverage.status` as `partial` |

## Release And CI Automation

| Command | Purpose |
| --- | --- |
| `pnpm check:release-flow` | Validate release workflow, packaging, and release manifest contracts |
| `pnpm check:ci-flow` | Validate the mainline CI workflow contract |
| `pnpm check:automation` | Run the full release and CI automation contract suite |

## Documentation Commands

| Command | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start the VitePress docs server |
| `pnpm docs:build` | Build the VitePress docs site |
| `pnpm docs:preview` | Preview the built VitePress site |

## Filtered Package Commands

Use pnpm filters to target one package:

```bash
pnpm --filter @sdkwork/clawstudio-web build
pnpm --filter @sdkwork/clawstudio-desktop tauri:info
pnpm --filter @sdkwork/clawstudio-market lint
```

## GitHub Release Flow

The repository release workflow lives at `.github/workflows/release.yml`.

- `push` tags matching `release-*` trigger a full Claw Studio release
- `workflow_dispatch` can rebuild assets for an existing tag or explicit git ref
- published assets include desktop bundles, native server archives, container bundles, kubernetes bundles, and a web/docs archive

