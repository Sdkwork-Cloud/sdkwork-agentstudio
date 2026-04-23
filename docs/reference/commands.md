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
| `pnpm release:package:web` | Archive built web and docs assets into `artifacts/release` |

## Server And Deployment Commands

| Command | Purpose |
| --- | --- |
| `pnpm server:dev` | Run the native Rust server host in development mode |
| `pnpm server:build` | Build the native Rust server binary in release mode; append `-- --target <triple>` for an explicit release target. Windows hosts automatically route Linux targets through WSL when an installed distro is available |
| `pnpm check:multi-mode` | Run the highest-signal local gate across desktop, server, unified host runtime, OpenClaw readiness, and release packaging contracts |
| `pnpm check:server` | Validate server package structure and run native Rust server tests |
| `pnpm check:sdkwork-host-runtime` | Validate the unified runtime authority and smoke contracts that span desktop, server, docker, and kubernetes ownership boundaries |
| `pnpm release:plan` | Resolve the current multi-family release plan and emit the target matrices |
| `pnpm release:package:server` | Package a native server archive into `artifacts/release`; the local wrapper refreshes the matching target server binary through an incremental build before packaging |
| `pnpm release:package:container` | Package Docker deployment bundles into `artifacts/release`; the local wrapper refreshes the matching Linux server binary through an incremental build before packaging. On Windows that build can reuse WSL automatically |
| `pnpm release:package:kubernetes` | Package Helm-compatible deployment bundles into `artifacts/release`; packages chart assets without building a server binary |
| `pnpm release:smoke:desktop` | Re-run packaged desktop installer smoke and launched-session startup smoke for an existing packaged desktop target |
| `pnpm release:smoke:desktop-packaged-launch` | Launch the canonical packaged desktop artifact for one target and capture isolated packaged-session startup evidence |
| `pnpm release:smoke:desktop-startup` | Validate captured packaged desktop startup evidence and emit the canonical desktop startup smoke report |
| `pnpm release:smoke:server` | Re-run packaged server bundle smoke for an existing packaged server artifact set |
| `pnpm release:smoke:container` | Re-run packaged Docker deployment smoke for an existing container release bundle |
| `pnpm release:smoke:kubernetes` | Re-run packaged chart rendering and readiness smoke for an existing kubernetes release bundle |
| `pnpm release:finalize` | Merge family manifests, compute top-level checksums, and emit `release-manifest.json` in the active release asset directory, which defaults to `artifacts/release` locally; the local wrapper resolves `repository` from `SDKWORK_RELEASE_REPOSITORY`, then `GITHUB_REPOSITORY`, then `git remote origin`, and preserves structured skipped deployment smoke for `container` and `kubernetes` artifacts |

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
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
pnpm --filter @sdkwork/claw-market lint
```

## GitHub Release Flow

The repository release workflow lives at `.github/workflows/release.yml`.

- `push` tags matching `release-*` trigger a full Claw Studio release
- `workflow_dispatch` can rebuild assets for an existing tag or explicit git ref
- published assets include desktop bundles, native server archives, container bundles, kubernetes bundles, and a web/docs archive
