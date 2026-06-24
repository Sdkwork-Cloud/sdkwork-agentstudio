> Migrated from `docs/core/architecture.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Architecture

## Dependency Direction

Claw Studio follows a strict dependency flow:

```text
web/desktop -> shell -> feature -> (commons + core + infrastructure + i18n + types + ui)
shell -> (core + i18n + ui + feature)
core -> (infrastructure + i18n + types)
infrastructure -> (i18n + types)
```

This rule keeps application entry packages small, makes feature packages portable, and prevents hidden dependencies between unrelated business areas.

## Layer Responsibilities

### Web And Desktop

- bootstrap the runtime
- mount the shared shell
- provide platform-specific integration only
- never own mock business databases, fake API servers, or feature-local transport logic

They should not own core stores, feature services, or page logic.

### Shell

`@sdkwork/claw-shell` owns composition concerns:

- router
- layouts
- providers
- sidebar
- command palette
- global shell UX

The shell assembles feature exports. It should not turn into a monolith with feature-local services or stores.

### Core

`@sdkwork/claw-core` holds cross-feature state and orchestration, such as global stores and shared hooks. It is not a dumping ground for feature-local services.

### Types And Infrastructure

- `types`: pure shared models and types
- `infrastructure`: environment access, HTTP clients, platform adapters, update helpers
- `i18n`: locale detection, formatting, and translation bootstrap that can be used by shell, core, infrastructure, commons, and feature UI
- temporary mock adapters that unblock feature development belong in service or infrastructure layers, not in the web host

### Feature Packages

Feature packages own their own `components`, `pages`, and `services` directories. Examples include:

- `@sdkwork/claw-chat`
- `@sdkwork/claw-market`
- `@sdkwork/claw-settings`
- `@sdkwork/claw-account`
- `@sdkwork/claw-extensions`

Feature packages may depend on `@sdkwork/claw-i18n` for locale-aware formatting and language metadata, but they should not initialize a second i18n runtime.

## Root-Only Imports

Cross-package imports must target the package root:

```ts
import { Settings } from '@sdkwork/claw-settings';
```

This repository rejects imports that reach into another package's internal files.

## Enforced Repository Rules

The architecture checker validates:

- required package directory structure
- allowed dependency directions
- root-only cross-package imports
- package export shape
- web shell boundary rules

Run it explicitly with:

```bash
pnpm check:arch
```

## Why This Matters

The workspace was migrated from `upgrade/claw-studio-v5`, which remains the functional and visual reference baseline. The package structure preserves the same product surface while making ownership explicit and long-term maintenance safer.

