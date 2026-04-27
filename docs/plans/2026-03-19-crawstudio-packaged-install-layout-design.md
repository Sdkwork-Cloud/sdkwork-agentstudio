# CrawStudio Packaged Install Layout Design

**Date:** 2026-03-19

**Status:** Approved for implementation

## Goal

Define a durable Windows-first packaged install layout for `CrawStudio` that:

- uses system-level installation
- keeps product-critical capabilities out of `AppData`
- treats `openclaw`, `zeroclaw`, `ironclaw`, and `codex` as built-in managed modules
- supports hot update, rollback, retention control, and future module growth
- stays easy for humans, automation, and large-model tooling to understand over time

## Problem Summary

The current desktop runtime still follows a generic app-data layout:

- runtime directories are rooted under Tauri app config, app data, app cache, and app log folders
- plugin and integration paths live beside other mutable data
- there is no clear separation between product binaries, machine state, and user assets
- versioned module storage would grow without a strict retention and activation model

That layout is acceptable for a prototype, but it is not strong enough for a production-grade packaged desktop application with built-in third-party modules and long-lived upgrade cycles.

## Design Principles

- Separate static product assets from mutable machine state.
- Separate machine state from user-private assets.
- Treat built-in modules and runtimes as product assets, not disposable user data.
- Keep runnable directories small and stable.
- Keep historical packages finite and policy-driven.
- Use explicit metadata files instead of symlink-heavy or implicit layouts.
- Make the directory semantics obvious enough for humans and LLM-based maintenance to reason about safely.

## Naming Decision

The requested app user root is `~/.sdkwork/crawstudio/`.

This design preserves that exact app user root even though the repository and product history elsewhere still use `claw` naming. The install standard should follow the requested packaged-product contract:

- install root: `C:\Program Files\SdkWork\CrawStudio\`
- machine state root: `C:\ProgramData\SdkWork\CrawStudio\`
- user asset root: `C:\Users\<user>\.sdkwork\crawstudio\`

## Final Layout

### 1. Install Root

```text
C:\Program Files\SdkWork\CrawStudio\
  CrawStudio.exe
  CrawStudioUpdater.exe
  CrawStudioService.exe

  foundation\
    manifests\
    presets\
    templates\

  modules\
    manifest.json

    openclaw\
      active\
      fallback\

    zeroclaw\
      active\
      fallback\

    ironclaw\
      active\
      fallback\

    codex\
      active\
      fallback\

  runtimes\
    manifest.json

    node\
      active\
      fallback\

    python\
      active\
      fallback\

  tools\
    bridge\
    diagnose\
    migrate\
    repair\

  trust\
    app\
    modules\
    updates\

  packs\
    prompts\
    rules\
    resources\

  extensions\
    plugins\
```

### 2. Machine State Root

```text
C:\ProgramData\SdkWork\CrawStudio\
  state\
    app.json
    layout.json
    active.json
    inventory.json
    retention.json
    pinned.json
    channels.json
    policies.json
    sources.json
    service.json

  store\
    modules\
      openclaw\
        packages\
          <version>.pkg
      zeroclaw\
        packages\
          <version>.pkg
      ironclaw\
        packages\
          <version>.pkg
      codex\
        packages\
          <version>.pkg

    runtimes\
      node\
        packages\
          <version>.pkg
      python\
        packages\
          <version>.pkg

  staging\
    downloads\
    extracted\
    patch\
    swap\

  receipts\
    installs\
    updates\
    rollbacks\

  runtime\
    jobs\
    locks\
    health\
    state\

  recovery\
    snapshots\
    restore\

  logs\
    app\
    updater\
    service\
    audit\
```

### 3. User Asset Root

```text
C:\Users\<用户名>\.sdkwork\crawstudio\
  user\
    profile.json
    preferences.json

    auth\
      openclaw.json
      zeroclaw.json
      ironclaw.json
      codex.json

    storage\

    integrations\

  studio\
    instances\
      <instanceId>\
        instance.json
        config\
        data\
        bindings\

    workspaces\
      <workspaceId>\
        workspace.json
        indexes\
        sessions\

    backups\
      instances\
      workspaces\
      exports\

  logs\
    ui.log
    user.log
```

## Why This Layout Is The Best Current Fit

### Install root only keeps runnable product assets

`Program Files` should contain the application itself and the built-in capabilities that define the packaged product:

- the desktop executables
- managed runtimes such as `node` and `python`
- managed built-in modules such as `openclaw`, `zeroclaw`, `ironclaw`, and `codex`
- machine-shared bridge tools and repair tools
- trusted signing material
- built-in prompt, rule, and resource packs
- machine-shared plugins or extensions

These assets are expensive to lose, are part of the product contract, and should not live in locations commonly treated as disposable application data.

### Machine state belongs in ProgramData

`ProgramData` is the correct writable machine scope for:

- active-version truth
- machine-level app configuration
- retention policy
- update channels and source configuration
- staged downloads and extracted update payloads
- install, update, and rollback receipts
- health state and lock files
- machine-level operational logs

This keeps frequent writes out of `Program Files` while avoiding the fragility of `AppData` as the primary lifecycle store.

### User assets belong in ~/.sdkwork/crawstudio

The user directory should only hold user-private material:

- user preferences
- user auth configuration and credential references
- local storage profiles
- user-scoped integration configuration
- instances, workspaces, and user backups
- user-interface logs

This keeps user data portable and avoids mixing user state into the machine-wide update lifecycle.

## Managed Module Model

The built-in modules are managed uniformly:

- `openclaw`
- `zeroclaw`
- `ironclaw`
- `codex`

Each module has two runnable slots in `Program Files`:

- `active`: the current live version
- `fallback`: the previous known-good version for immediate rollback

Historical versions are not kept as expanded directories in the install root. They are stored as signed packages under `ProgramData\...\store\modules\<module>\packages\`.

This gives the best balance between:

- fast rollback
- bounded install-directory size
- bounded machine-store size
- explicit, inspectable state

## Managed Runtime Model

Managed runtimes follow the same pattern as modules:

- `active`
- `fallback`
- finite historical package storage in `ProgramData`

This is important because runtimes are also product-critical dependencies and should not drift into user-data locations or infinite history folders.

## Package And Slot Semantics

### Runnable slots

Runnable slots are expanded directories:

- `modules\<module>\active\`
- `modules\<module>\fallback\`
- `runtimes\<runtime>\active\`
- `runtimes\<runtime>\fallback\`

They must stay small in count and always be runnable without a restore step.

### Stored packages

Stored packages are finite `.pkg` files under `ProgramData\...\store\...`.

They exist to support:

- staged updates
- finite historical retention
- rehydrating the fallback slot if needed
- controlled repair workflows

They are not ordinary cache. They are managed machine-level package inventory.

## Retention Strategy

The directory standard must enforce retention as part of the product contract.

### Module retention

For each built-in module:

- always keep `active`
- always keep `fallback`
- keep at most `3` historical stable `.pkg` files
- keep any pinned version regardless of age
- never delete a package still referenced by `active` or `fallback`

### Runtime retention

For each managed runtime:

- always keep `active`
- always keep `fallback`
- keep at most `2` historical stable `.pkg` files
- never delete a runtime package still referenced by any active or fallback module slot

### Cleanup order

Cleanup is deterministic:

1. remove expired staging artifacts
2. remove stale failed candidates
3. remove oldest unpinned historical packages
4. stop before touching any active, fallback, or referenced package

All cleanup must be executed by `CrawStudioService.exe`, not by the UI layer.

## Metadata Model

The final structure avoids a large number of small `catalog\*.json` and `current\*.json` files.

Instead:

- install-root metadata is aggregated into `modules\manifest.json` and `runtimes\manifest.json`
- machine-level current truth is aggregated into `ProgramData\...\state\active.json`
- retention policy lives in `ProgramData\...\state\retention.json`
- installation inventory lives in `ProgramData\...\state\inventory.json`

This is easier to audit, easier to version, and easier for automation to understand.

### State File Responsibilities

The machine-level `state\` directory should stay small, explicit, and stable. Each file has one clear responsibility:

- `app.json`: machine-level application configuration defaults and normalized runtime settings
- `layout.json`: the directory-standard contract itself, including layout version and the three resolved roots
- `active.json`: current `active` and `fallback` version truth for built-in modules and managed runtimes
- `inventory.json`: machine-visible package inventory snapshot for retained module and runtime packages
- `retention.json`: bounded-history policy, including how many historical packages are allowed per domain
- `pinned.json`: versions that must never be pruned automatically even when they are old
- `channels.json`: selected update channel for each built-in module or managed runtime when channel routing is enabled
- `policies.json`: machine-level update and rollback guardrails, such as whether hot update and signed-package enforcement are allowed
- `sources.json`: approved package-source registry for modules and runtimes
- `service.json`: service execution mode and machine-health timestamps used by background cleanup, repair, and update orchestration

## Directory Responsibilities

### `foundation`

Static install-time reference material:

- default manifests
- packaged presets
- packaged templates

### `modules`

Runnable expanded built-in module slots plus module-definition metadata.

### `runtimes`

Runnable expanded runtime slots plus runtime-definition metadata.

### `tools`

Machine-shared helper executables and operational tools:

- bridge binaries
- diagnostics
- migration helpers
- repair utilities

### `trust`

Signing keys, trust anchors, and verification metadata for:

- app updates
- module updates
- runtime updates

### `packs`

Managed built-in content packs that belong to the product:

- prompts
- rules
- resources

### `extensions\plugins`

Machine-shared plugin payloads or extension bundles that are product capabilities rather than user documents.

### `state`

Machine-readable truth for:

- active versions
- retention policy
- sources and channels
- service configuration

### `store`

Finite package inventory. Not a cache. Not a temp directory.

### `staging`

Temporary but managed operational work area for downloads, extraction, patching, and atomic swap preparation.

### `receipts`

Structured historical receipts for:

- installs
- updates
- rollbacks

### `runtime`

Machine runtime state:

- jobs
- locks
- health probes
- transient service state

### `recovery`

Recovery snapshots and restore indexes used by rollback and repair.

### `logs`

Operational logs separated by responsibility.

### `user\storage`

User-scoped storage profiles and default local file-backed storage roots.

This replaces the current ambiguous app-data storage root and makes the persistence scope explicit.

### `user\integrations`

User-scoped integration configuration, including provider and instance bridge configuration that may contain user-specific routing state or auth references.

This intentionally stays out of the install root because it is mutable and user-specific, even if the module binary itself is machine-shared.

### `studio`

User work product:

- instances
- workspaces
- backups

## Upgrade And Rollback Model

### Update flow

1. service downloads a package into `ProgramData\...\staging\downloads`
2. service validates signature and checksum
3. service writes the validated package into `ProgramData\...\store`
4. service expands the candidate into the install-root `fallback` or swap area
5. service atomically promotes the new version into `active`
6. service updates `active.json`, `inventory.json`, and receipts
7. service applies retention cleanup

### Rollback flow

1. service marks the current `active` as failed
2. service promotes `fallback` back to `active`
3. if needed, service rehydrates a historical package from `ProgramData\...\store` into `fallback`
4. service records the rollback in receipts and `active.json`

## Layout Versioning

The directory standard itself must be versioned.

`ProgramData\SdkWork\CrawStudio\state\layout.json` should at minimum record:

- `layoutVersion`
- `productId`
- `installRoot`
- `machineRoot`
- `userRoot`
- `lastMigratedAt`

This allows future migrations without relying on hidden heuristics.

## Non-Goals

This design does not yet define:

- the final `.pkg` file format
- the exact JSON schema of every metadata file
- the full update protocol wire format

Those belong to the implementation plan and follow-up contracts.

## Success Criteria

- The packaged desktop app installs system-wide under `Program Files`.
- Built-in modules and runtimes no longer depend on `AppData` for their runnable locations.
- Machine state is writable without turning `Program Files` into a mutable data store.
- User-private assets remain isolated in `~/.sdkwork/crawstudio/`.
- Historical versions remain finite by policy and cannot grow without bound.
- The resulting structure is readable, explicit, and safe for humans and automation to operate.
