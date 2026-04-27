# Claw V5 Dual-Host Migration Design

## Goal

Rebuild the current Claw Studio workspace so it fully matches `upgrade/claw-studio-v5` in product functionality, route surface, visual presentation, and feature capability, while preserving a dual-host application architecture for both browser web and Tauri desktop.

The final package system must adopt the new `sdkwork-claw-*` directory layout, the new `@sdkwork/claw-*` package naming scheme, and a reusable shared UI foundation in `sdkwork-claw-ui`.

## Product Constraints

### Functional baseline

`upgrade/claw-studio-v5` is the source of truth for:

- routes
- pages
- feature boundaries
- services
- shell behavior
- visual hierarchy
- product capability surface

### Host constraint

The migrated product must preserve two application hosts:

- browser web host
- Tauri desktop host

These hosts must share a single product layer rather than drift into separate implementations.

### Migration strategy constraint

The migration must happen incrementally. The workspace must remain runnable throughout the transition, and old packages may remain temporarily as compatibility bridges until the new architecture is verified.

## Recommended Approach

### Option A: phased parallel migration with compatibility bridges

Build the new `sdkwork-claw-*` package tree alongside the current `claw-studio-*` packages, migrate shared foundations first, migrate feature packages next, switch the hosts to the new graph, then remove the old packages after verification.

Pros:

- lowest migration risk
- preserves working web and desktop builds during transition
- allows route-by-route and package-by-package verification
- supports clean extraction of `sdkwork-claw-ui`

Cons:

- temporary duplication
- more migration bookkeeping

### Option B: feature-first migration, rename later

Port all `v5` features into the current package graph first, then rename packages and imports in a second pass.

Pros:

- faster access to the V5 product surface

Cons:

- defers the biggest architecture risk
- creates a second large-cutover phase

### Option C: big-bang package and host replacement

Replace all packages, routing, naming, and runtime wiring at once.

Pros:

- shortest path to the final shape in theory

Cons:

- highest risk
- easiest way to break web and desktop simultaneously

### Recommendation

Use Option A. It is the only approach that fits the requirement to preserve runtime continuity while landing a full architecture rename and a complete V5 product migration.

## Target Architecture

### Host packages

- `packages/sdkwork-claw-web`
  - package name: `@sdkwork/claw-web`
  - responsibility: browser host bootstrap, browser-only environment setup, dev server entry

- `packages/sdkwork-claw-desktop`
  - package name: `@sdkwork/claw-desktop`
  - responsibility: Tauri host bootstrap, native bridge, desktop-only providers, native command wiring

### Shared composition layer

- `packages/sdkwork-claw-shell`
  - package name: `@sdkwork/claw-shell`
  - responsibility: shared routing, layouts, providers, navigation, command palette, app-level composition

### Shared foundation packages

- `packages/sdkwork-claw-ui`
  - package name: `@sdkwork/claw-ui`
  - responsibility: shared UI primitives, workbench components, tokens, layout primitives
  - tech stack: `shadcn/ui + Radix UI + Tailwind CSS + motion`

- `packages/sdkwork-claw-core`
  - package name: `@sdkwork/claw-core`
  - responsibility: app store, runtime capability contracts, navigation metadata, command system, shared orchestration

- `packages/sdkwork-claw-i18n`
  - package name: `@sdkwork/claw-i18n`
  - responsibility: i18n bootstrap and locale resources

- `packages/sdkwork-claw-types`
  - package name: `@sdkwork/claw-types`
  - responsibility: shared types, DTOs, entities, shared business models

- `packages/sdkwork-claw-distribution`
  - package name: `@sdkwork/claw-distribution`
  - responsibility: desktop distribution manifests and distribution metadata

### Feature packages

All V5-aligned feature packages use:

- directory pattern: `packages/sdkwork-claw-<feature>`
- package name pattern: `@sdkwork/claw-<feature>`

Required features include:

- `account`
- `apps`
- `auth`
- `center`
- `channels`
- `chat`
- `community`
- `devices`
- `docs`
- `extensions`
- `github`
- `huggingface`
- `install`
- `instances`
- `market`
- `settings`
- `tasks`

## Package Mapping

### Host and foundation mapping

- `claw-studio-web` -> `sdkwork-claw-web`
- `claw-studio-desktop` -> `sdkwork-claw-desktop`
- `claw-studio-shell` -> `sdkwork-claw-shell`
- `claw-studio-shared-ui` + V5 `sdkwork-claw-commons` -> `sdkwork-claw-ui`
- selected shared behavior from `claw-studio-business` -> `sdkwork-claw-core`
- i18n modules from `claw-studio-infrastructure` -> `sdkwork-claw-i18n`
- pure types from `claw-studio-domain` and other shared packages -> `sdkwork-claw-types`
- `claw-studio-distribution` -> `sdkwork-claw-distribution`

### Feature mapping

- `claw-studio-account` -> `sdkwork-claw-account`
- `claw-studio-apps` -> `sdkwork-claw-apps`
- `claw-studio-channels` -> `sdkwork-claw-channels`
- `claw-studio-chat` -> `sdkwork-claw-chat`
- `claw-studio-claw-center` -> `sdkwork-claw-center`
- `claw-studio-community` -> `sdkwork-claw-community`
- `claw-studio-devices` -> `sdkwork-claw-devices`
- `claw-studio-docs` -> `sdkwork-claw-docs`
- `claw-studio-extensions` -> `sdkwork-claw-extensions`
- `claw-studio-github` -> `sdkwork-claw-github`
- `claw-studio-huggingface` -> `sdkwork-claw-huggingface`
- `removed-install-feature` -> `removed-install-feature`
- `claw-studio-instances` -> `sdkwork-claw-instances`
- `claw-studio-market` -> `sdkwork-claw-market`
- `claw-studio-settings` -> `sdkwork-claw-settings`
- `claw-studio-tasks` -> `sdkwork-claw-tasks`
- add missing V5 feature: `sdkwork-claw-auth`

### Out of scope for the main product template

- `packages/cc-switch`

`cc-switch` must not remain inside the main Claw product execution path or template story.

## Dependency Rules

### Host dependency rules

- `@sdkwork/claw-web` -> `@sdkwork/claw-shell`
- `@sdkwork/claw-desktop` -> `@sdkwork/claw-shell`

Hosts do not own feature state or feature-local services.

### Shell dependency rules

`@sdkwork/claw-shell` may depend on:

- `@sdkwork/claw-core`
- `@sdkwork/claw-ui`
- `@sdkwork/claw-i18n`
- active feature packages

`shell` composes the app but does not own feature-local business logic.

### Feature dependency rules

Feature packages may depend on:

- `@sdkwork/claw-ui`
- `@sdkwork/claw-core`
- `@sdkwork/claw-i18n`
- `@sdkwork/claw-types`

Feature packages may not import other feature packages through deep internal paths.

### Desktop-only dependency rules

`@sdkwork/claw-desktop` may additionally depend on:

- `@sdkwork/claw-distribution`
- Tauri APIs
- native bridge modules

Desktop-specific dependencies must not leak upward into shell or feature packages.

## Runtime Capability Model

Browser and desktop must share the same product routes, pages, and feature packages.

Platform-specific abilities are injected through shared capability contracts owned by `@sdkwork/claw-core`. These capabilities include:

- filesystem
- process and jobs
- dialogs
- updater
- terminal
- open external browser

Feature packages consume runtime capabilities through `@sdkwork/claw-core` abstractions only. They must not call Tauri commands directly.

Browser host implementations must provide graceful fallback behavior where desktop-native capabilities are unavailable.

## UI System

### Goal

`sdkwork-claw-ui` becomes the shared UI foundation for the Claw product family and for future template reuse.

### Technology

- `shadcn/ui`
- `@radix-ui/*`
- `tailwindcss`
- `motion`

### Scope

`sdkwork-claw-ui` owns:

- design tokens
- low-level primitives
- dialogs, tabs, dropdowns, sheets, tooltips, command UI
- reusable layout primitives
- common workbench components
- shared feedback components

Feature-specific visual components remain within feature packages unless they clearly form reusable patterns.

### Visual migration rule

The migration must first preserve the visual look and user-facing behavior of `upgrade/claw-studio-v5` as closely as possible. UI improvement or aesthetic divergence is not the primary goal of this migration phase.

## Migration Phases

### Phase 1: create the new package skeleton

Create the new `sdkwork-claw-*` package tree and make it resolvable in the workspace while preserving the current runnable app.

### Phase 2: migrate shared foundations

Re-home the long-lived shared logic into:

- `sdkwork-claw-ui`
- `sdkwork-claw-core`
- `sdkwork-claw-i18n`
- `sdkwork-claw-types`
- `sdkwork-claw-distribution`

The old shared packages remain only as temporary bridges during this phase.

### Phase 3: migrate V5 feature packages

Create or port every V5 feature package and align:

- routes
- pages
- services
- stores
- visual surface
- translations

### Phase 4: switch browser and desktop hosts to the new graph

Point both new hosts at the shared shell and the new package graph while preserving host-specific providers and capabilities.

### Phase 5: remove obsolete packages and finalize the template

Delete bridge packages and dead references after the new graph is fully verified.

## Verification Strategy

### Package structure verification

Must prove:

- directory names use `sdkwork-claw-*`
- package names use `@sdkwork/claw-*`
- the new hosts are the only active host entries
- old packages are no longer on the active execution path

### Product surface verification

Must prove:

- all V5 routes are present
- all V5 feature pages exist
- sidebar and navigation match V5
- missing gaps such as `/auth` and `/claw-upload` are restored

### Visual verification

Must prove:

- layout hierarchy matches V5
- shared components preserve the V5 product appearance
- themes, spacing, and visual semantics remain aligned
- key pages receive manual screenshot-level review

### Dual-host verification

Must prove:

- browser host can `dev`, `build`, and `preview`
- desktop host can `tauri:dev` and `tauri:build` or equivalent verification
- browser uses graceful fallbacks for unavailable desktop capabilities
- desktop exposes the full runtime feature set

### Template verification

Must prove:

- dependency directions are documented and enforced
- shared UI is reusable
- host, shell, capability, and feature boundaries are stable
- template-oriented documentation exists for reuse

## Definition of Done

The migration is complete only when all of the following are true:

- product functionality matches `upgrade/claw-studio-v5`
- route surface matches `upgrade/claw-studio-v5`
- visual presentation and interaction flow closely match `upgrade/claw-studio-v5`
- browser and Tauri desktop hosts both run on the new package graph
- package directories use `sdkwork-claw-*`
- package names use `@sdkwork/claw-*`
- `sdkwork-claw-ui` is the active shared UI foundation
- obsolete `claw-studio-*` bridge packages are removed from the main path
- `cc-switch` is outside the main template flow
- lint, build, route checks, architecture checks, and host verification pass
