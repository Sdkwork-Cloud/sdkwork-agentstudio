> Migrated from `docs/core/packages.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Packages

## Workspace Layout

The repository is a `pnpm` workspace with packages under `packages/*`.

## Application And Runtime Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/agentstudio-pc-web` | Web entry application and development server |
| `@sdkwork/agentstudio-pc-desktop` | Tauri desktop entry, native bridge, and packaging scripts |
| `@sdkwork/agentstudio-pc-shell` | Routes, layout, providers, sidebar, command palette, shell composition |
| `@sdkwork/agentstudio-pc-distribution` | Desktop distribution manifests and provider-level distribution metadata |

## Shared Core Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/agentstudio-pc-core` | Shared stores, hooks, and cross-feature orchestration |
| `@sdkwork/agentstudio-pc-types` | Types, DTOs, and shared product models |
| `@sdkwork/agentstudio-pc-infrastructure` | Environment, HTTP, i18n, update client, and platform helpers |
| `@sdkwork/agentstudio-pc-ui` | Shared visual primitives used by feature packages |

## Feature Packages

The current workspace includes feature-oriented packages such as:

- `@sdkwork/agentstudio-pc-account`
- `@sdkwork/agentstudio-pc-apps`
- `@sdkwork/agentstudio-pc-channels`
- `@sdkwork/agentstudio-pc-chat`
- `@sdkwork/agentstudio-pc-center`
- `@sdkwork/agentstudio-pc-community`
- `@sdkwork/agentstudio-pc-devices`
- `@sdkwork/agentstudio-pc-docs`
- `@sdkwork/agentstudio-pc-extensions`
- `@sdkwork/agentstudio-pc-github`
- `@sdkwork/agentstudio-pc-huggingface`
- `removed-install-feature`
- `@sdkwork/agentstudio-pc-instances`
- `@sdkwork/agentstudio-pc-market`
- `@sdkwork/agentstudio-pc-settings`
- `@sdkwork/agentstudio-pc-tasks`

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

This repository also contains `packages/cc-switch`, but it is documented separately and is not part of the main Agent Studio workspace flow. The main public documentation here is intentionally centered on Agent Studio.

