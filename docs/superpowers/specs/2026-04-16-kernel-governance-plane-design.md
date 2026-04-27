# Kernel Governance Plane Design

## Status

Approved design baseline for implementation planning.

## Goal

Turn the current OpenClaw-biased runtime governance model into a standard kernel governance plane that can manage OpenClaw, Hermes, and future kernels without redesigning the desktop host every time a new kernel is added.

## Scope

This design focuses on kernel governance and upgrade maintenance:

- release source ownership
- runtime path ownership
- machine-state ownership
- activation and rollback authority
- adapter registration
- kernel-facing version resolution
- desktop projection convergence for Kernel Center and instance detail

This design does not redesign the OpenClaw detail UI or broaden Hermes capabilities beyond its documented platform constraints.

## Problem Statement

The repo already has the beginnings of a multi-kernel catalog:

- `config/kernels/openclaw.json`
- `config/kernels/hermes.json`
- `config/kernel-profiles/*.json`

But the governance plane is still OpenClaw-specific:

- version source is centered on `config/openclaw-release.json`
- `AppPaths` hardcodes `openclaw_*` roots
- authority and upgrade state default to `openclaw`
- `KernelRuntimeAuthorityService` exposes OpenClaw-only methods
- `activate_runtime_version()` special-cases `OPENCLAW_RUNTIME_ID`
- desktop projections still resolve built-in version truth through OpenClaw-only logic

This creates four concrete risks:

1. version drift
2. path drift
3. authority drift
4. platform-level branching for every future kernel

## Decision Summary

Adopt a unified `Kernel Governance Plane` with six layers:

1. `Kernel Catalog`
2. `Kernel Release Registry`
3. `Kernel Package Profile`
4. `Kernel Authority Store`
5. `Kernel Adapter Registry`
6. `Kernel Upgrade Orchestrator`

This is a hard-cut architecture direction for the governance plane. Compatibility readers can exist during migration, but the target model must be one standard model, not a permanent dual contract.

## Core Decisions

### 1. Release Source Unification

Kernel version truth moves to:

- `config/kernel-releases/openclaw.json`
- `config/kernel-releases/hermes.json`
- `config/kernel-releases/<future-kernel>.json`

`config/openclaw-release.json` becomes a migration-era compatibility source and should be retired after the OpenClaw migration completes.

Rules:

- build-time constants and bundled manifests are projections only
- UI display version must resolve from authority plus install manifest plus release registry
- staged newer installs must not overwrite active version display

### 2. Path Standardization

Platform-managed runtime paths become kernel-scoped instead of OpenClaw-scoped.

Target shape:

```text
install/runtimes/<kernelId>/releases/<installKey>/
install/runtimes/<kernelId>/current/
machine/state/kernels/<kernelId>/authority.json
machine/state/kernels/<kernelId>/upgrades.json
machine/state/kernels/<kernelId>/migrations.json
machine/state/kernels/<kernelId>/installs.json
machine/state/kernels/<kernelId>/instances.json
machine/state/kernels/<kernelId>/doctor.json
machine/state/kernels/<kernelId>/managed-config/
app-user-root/kernels/<kernelId>/home/
app-user-root/kernels/<kernelId>/state/
app-user-root/kernels/<kernelId>/workspace/
```

Rules:

- `AppPaths` must stop growing kernel-specific top-level fields
- shared code resolves kernel roots through a kernel path resolver
- adapter-owned subpaths that affect runtime identity also resolve through the kernel path resolver. For OpenClaw, `main` maps to the primary workspace and `agents/main/{agent,sessions}`; every non-main agent maps to `.openclaw/workspace-<normalizedAgentId>` and `.openclaw/agents/<normalizedAgentId>/agent`. The normalized agent id is lowercase, path-safe, and capped at 64 characters.
- OpenClaw built-in mode must not persist `agents.defaults.workspace` or `agents.defaults.agentDir`; those fields create global fallback behavior and bypass the standard per-agent directory contract.
- cleanup and migration operate only on authority-owned roots

### 3. State Normalization

Platform aggregate files such as `active.json` and `inventory.json` remain as indexes, but kernel-specific authority moves under `machine/state/kernels/<kernelId>/`.

Rules:

- `KernelAuthorityState` must become kernel-neutral
- `RuntimeUpgradesState` must no longer default to an `openclaw`-only map
- kernel state initialization comes from registry-driven bootstrap, not hardcoded defaults

### 4. Adapter-Driven Governance

Every kernel integrates through one adapter registry instead of platform-level `if kernel == openclaw` branches.

Required adapter responsibilities:

- definition lookup
- release resolution
- doctor/preflight
- install staging
- install verification
- activation
- rollback
- instance projection
- console entry resolution
- management-path resolution

Rules:

- OpenClaw and Hermes differ inside the adapter boundary only
- no future kernel may require core host services to grow new runtime-id branches
- kernel ids are canonical lowercase identifiers; UI, config, and adapter inputs may be normalized at the boundary, but persisted state and derived paths must use only the canonical id
- the kernel path resolver owns runtime `home`, runtime `state`, and `workspace` paths in addition to install and machine authority paths; host, supervisor, snapshot, and workbench surfaces must consume these resolver fields instead of per-kernel compatibility fields

### 5. Upgrade Orchestration Standard

All kernel upgrade flows use the same high-level state machine:

```text
resolved
-> doctorPassed
-> staged
-> verified
-> activated
-> observedHealthy
```

Failure path:

```text
failed
-> rollbackStarted
-> rollbackCompleted
-> repairRequired
```

Rules:

- directory replacement alone is not success
- success requires authority write plus health evidence
- each activation creates receipts and audit records
- startup code must not fall back from canonical kernel path resolution to legacy per-kernel fields; resolver failure is a standard violation and should fail loudly

## Kernel-Type Compatibility Model

The platform must support three categories without changing the governance model:

### Managed Local Kernel

Example:

- OpenClaw

Platform owns install, activate, rollback, startup, health, and managed config roots.

### External Local Or WSL Kernel

Example:

- Hermes

Platform owns catalog, doctor, attach, projection, console entry, and compatibility state. It may not own the kernel's entire runtime directory.

### Remote Kernel

Examples:

- future remote Hermes
- future Zeroclaw or Ironclaw deployments

Platform owns release compatibility, endpoint projection, routing, and machine authority metadata, even when activation is delegated to a remote rollout contract.

## Migration Strategy

### Phase 1: Governance Foundation

- introduce kernel release registry files
- add registry-driven kernel metadata loading
- add kernel path resolver and kernel-scoped machine state roots

### Phase 2: Generic Authority And Upgrade Services

- replace OpenClaw-only authority method names and defaults
- refactor runtime activation to call adapter hooks
- keep compatibility readers for legacy OpenClaw files during migration only

### Phase 3: OpenClaw Migration

- route version display, managed config resolution, and activation bookkeeping through generic governance services
- preserve current OpenClaw behavior and UI
- stop treating OpenClaw-specific fields as platform truth

### Phase 4: Hermes Baseline

- attach Hermes to release registry, doctor, projection, and console resolution
- keep Hermes within its documented local external, WSL2, or remote constraints

## Validation Criteria

The design is complete only when all of the following are true:

- version source is unified under `config/kernel-releases/*.json`
- `AppPaths` no longer grows per-kernel top-level fields
- per-kernel authority lives under `machine/state/kernels/<kernelId>/`
- `upgrades.rs` no longer branches on `OPENCLAW_RUNTIME_ID` at platform level
- kernel display version resolves from one shared resolver
- OpenClaw and Hermes both enter the same governance plane through adapters
- adding a future kernel requires config plus adapter work, not platform redesign

## References

- `docs/架构/18-多内核治理与升级维护设计.md`
- `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs`
