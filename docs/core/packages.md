# Packages

## Workspace Layout

The repository is a `pnpm` workspace with packages under `packages/*`.

## Application And Runtime Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/clawstudio-web` | Web entry application and development server |
| `@sdkwork/clawstudio-desktop` | Tauri desktop entry, native bridge, and packaging scripts |
| `@sdkwork/clawstudio-shell` | Routes, layout, providers, sidebar, command palette, shell composition |
| `@sdkwork/clawstudio-distribution` | Desktop distribution manifests and provider-level distribution metadata |

## Shared Core Packages

| Package | Responsibility |
| --- | --- |
| `@sdkwork/clawstudio-core` | Shared stores, hooks, and cross-feature orchestration |
| `@sdkwork/clawstudio-types` | Types, DTOs, and shared product models |
| `@sdkwork/clawstudio-infrastructure` | Environment, HTTP, i18n, update client, and platform helpers |
| `@sdkwork/clawstudio-ui` | Shared visual primitives used by feature packages |

## Feature Packages

The current workspace includes feature-oriented packages such as:

- `@sdkwork/clawstudio-account`
- `@sdkwork/clawstudio-apps`
- `@sdkwork/clawstudio-channels`
- `@sdkwork/clawstudio-chat`
- `@sdkwork/clawstudio-center`
- `@sdkwork/clawstudio-community`
- `@sdkwork/clawstudio-devices`
- `@sdkwork/clawstudio-docs`
- `@sdkwork/clawstudio-extensions`
- `@sdkwork/clawstudio-github`
- `@sdkwork/clawstudio-huggingface`
- `removed-install-feature`
- `@sdkwork/clawstudio-instances`
- `@sdkwork/clawstudio-market`
- `@sdkwork/clawstudio-settings`
- `@sdkwork/clawstudio-tasks`

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
