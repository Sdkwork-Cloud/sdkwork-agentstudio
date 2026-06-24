> Migrated from `docs/core/packages.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Packages

## Workspace Layout

The repository is a `pnpm` workspace with packages under `packages/*`.

## Application And Runtime Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/claw-web` | Web entry application and development server |
| `@sdkwork/claw-desktop` | Tauri desktop entry, native bridge, and packaging scripts |
| `@sdkwork/claw-shell` | Routes, layout, providers, sidebar, command palette, shell composition |
| `@sdkwork/claw-distribution` | Desktop distribution manifests and provider-level distribution metadata |

## Shared Core Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/claw-core` | Shared stores, hooks, and cross-feature orchestration |
| `@sdkwork/claw-types` | Types, DTOs, and shared product models |
| `@sdkwork/claw-infrastructure` | Environment, HTTP, i18n, update client, and platform helpers |
| `@sdkwork/claw-ui` | Shared visual primitives used by feature packages |

## Feature Packages

The current workspace includes feature-oriented packages such as:

- `@sdkwork/claw-account`
- `@sdkwork/claw-apps`
- `@sdkwork/claw-channels`
- `@sdkwork/claw-chat`
- `@sdkwork/claw-center`
- `@sdkwork/claw-community`
- `@sdkwork/claw-devices`
- `@sdkwork/claw-docs`
- `@sdkwork/claw-extensions`
- `@sdkwork/claw-github`
- `@sdkwork/claw-huggingface`
- `removed-install-feature`
- `@sdkwork/claw-instances`
- `@sdkwork/claw-market`
- `@sdkwork/claw-settings`
- `@sdkwork/claw-tasks`

Each feature package must keep at least:

```text
src/components
src/pages
src/services
```

## Package Boundaries

- entry packages depend on the shell and shared layers
- feature packages may depend on `core`, `types`, `infrastructure`, and `ui`
- feature packages should not import internals from other feature packages
- root barrels are part of the architecture contract

## Related Package Family

This repository also contains `packages/cc-switch`, but it is documented separately and is not part of the main Claw Studio workspace flow. The main public documentation here is intentionally centered on Claw Studio.

