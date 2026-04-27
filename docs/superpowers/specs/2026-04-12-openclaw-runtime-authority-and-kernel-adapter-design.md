# OpenClaw Runtime Authority And Kernel Adapter Design

**Date:** 2026-04-12

> **Supersession Note (2026-04-13):** This document is preserved for historical implementation context. The current source of truth is `docs/superpowers/specs/2026-04-13-multi-kernel-platform-design.md`, with OpenClaw runtime packaging and activation aligned to `docs/superpowers/plans/2026-04-13-openclaw-external-node-hard-cut-implementation-plan.md`. The authority and adapter direction remains relevant, but references below to a bundled OpenClaw runtime or bundled Node assumptions are historical and must not drive new implementation.

## Goal

Stabilize bundled `OpenClaw` startup on real machines, remove legacy version residue from the managed runtime path, establish a complete upgrade and migration mechanism for bundled `OpenClaw`, and refactor the desktop host so the runtime lifecycle path can evolve into a multi-kernel architecture instead of remaining permanently hard-coded to `openclaw`.

This design intentionally splits the work into two sequential phases:

1. `OpenClaw Runtime Authority Hardening`
2. `Kernel Adapter Abstraction`

Phase 1 is the execution priority because it directly addresses the confirmed startup failure root cause.

## Root Cause Snapshot

The current startup instability is not caused by bundled activation never running. The bundled activation path does run and reaches `local-ai-proxy-ready`, but real machine logs show that startup then races with older managed `OpenClaw` processes that are still alive on the same machine.

Confirmed evidence:

- `app.log` shows bundled activation reaching:
  - `prepare-runtime-activation`
  - `bundled-runtime-ready`
  - `gateway-configured`
  - `local-ai-proxy-ready`
- the same run then times out waiting for loopback readiness on a port such as `127.0.0.1:18878`
- `openclaw-gateway.log` shows an older `OpenClaw 2026.3.28` instance:
  - reading config last written by newer `2026.4.9`
  - reacting to `gateway.port` rewrites
  - restarting itself
  - drifting ports from earlier values to the latest managed port
  - becoming ready only after the desktop host has already declared startup failure

The root cause is the combination of three concrete defects:

1. legacy `OpenClaw` runtimes still exist under the old managed runtime layout
2. stale-process cleanup only matches the new runtime root and therefore misses legacy managed gateway processes
3. the host still writes managed startup state into one shared `openclaw.json`, which allows an old runtime to observe and react to new runtime config mutations

The result is not a pure timeout problem. It is a runtime-authority problem.

## Existing Architectural Position

The repository already contains partial architecture for a broader kernel platform:

- `framework/kernel_host/*`
- `framework/kernel.rs`
- `framework/services/kernel.rs`

However, the actual lifecycle path is still `OpenClaw`-specific:

- `openclaw_runtime.rs` owns runtime install plus managed config mutation
- `supervisor.rs` directly knows how to prepare, spawn, probe, and reap the `OpenClaw` gateway
- many `studio.rs` call sites still treat `paths.openclaw_config_file` as the authoritative managed config path

The design direction is therefore not a greenfield rewrite. It is a controlled convergence:

- phase 1 introduces a real authority layer for the current `OpenClaw` path
- phase 2 extracts the stable contract from that authority so future kernels can reuse it

## Cross-Platform Constraint

Although the confirmed field failure was reproduced on Windows, the final design must hold across all supported desktop operating systems:

- Windows
- macOS
- Linux

The authority layer must therefore encode one platform-neutral lifecycle contract and only delegate true operating-system differences to platform-specific adapters.

Platform-neutral invariants:

- one authority-owned source of truth for runtime selection, migration state, and upgrade bookkeeping
- one authority-owned managed config path for the active bundled runtime
- stale managed-process cleanup must work for every owned runtime root discovered on the current machine
- startup readiness must be validated through the same contract regardless of service manager
- config and data migration must be idempotent on every supported filesystem model

Platform-specific behavior remains isolated to:

- service registration and repair
- process tree termination primitives
- platform path resolution
- filesystem edge handling such as file locks, rename semantics, and executable naming

This keeps the correctness model shared while still respecting OS-specific runtime behavior.

## Approaches Considered

### Approach A: Minimal bug patch

Patch stale-process matching to include the legacy runtime root and stop writing version metadata into the managed config.

Pros:

- fastest local repair
- smallest file surface

Cons:

- leaves upgrade state fragmented
- leaves managed config ownership ambiguous
- does not solve the lack of a single runtime source of truth
- does not create a path toward multi-kernel support

### Approach B: Runtime authority first, then generalize the contract

Introduce a single authority that owns runtime discovery, legacy cleanup, config generation, migration bookkeeping, activation preparation, and upgrade state for bundled `OpenClaw`. Once that authority exists, extract a generic kernel adapter contract around it.

Pros:

- fixes the confirmed startup race at the right layer
- removes old-version residue from the runtime path instead of only suppressing symptoms
- creates a durable upgrade and migration mechanism
- yields a clean foundation for multi-kernel support

Cons:

- larger first phase than a narrow bug patch
- requires touching `paths`, `openclaw_runtime`, `supervisor`, `studio`, and layout state

### Approach C: Full multi-kernel rewrite now

Replace the current lifecycle path with a complete generic kernel platform in one step.

Pros:

- maximal abstraction immediately

Cons:

- highest implementation risk
- delays the startup repair that is already rooted in current legacy state
- mixes architecture work with urgent field repair

## Decision

Adopt **Approach B**.

The implementation sequence is:

1. build a real `OpenClaw Runtime Authority`
2. migrate the current `OpenClaw` startup and upgrade flow onto that authority
3. extract a generic `KernelRuntimeAdapter` contract from the now-stable authority path

This is the shortest path to a stable system without baking the current one-off `OpenClaw` assumptions deeper into the desktop host.

## Phase 1: OpenClaw Runtime Authority Hardening

### Objectives

Phase 1 must deliver all of the following:

- bundled startup no longer races with legacy managed `OpenClaw` processes
- host-owned version metadata is removed from the live `OpenClaw` config surface
- upgrade, rollback, and migration state for the bundled runtime become explicit and auditable
- managed config generation is no longer ad hoc writes into one legacy compatibility file
- data/config migration is idempotent and recorded

### New Ownership Model

Introduce a new service layer under the desktop host:

- `framework/services/kernel_runtime_authority.rs`

This service becomes the single owner of:

- discovering managed bundled runtime installs
- discovering legacy runtime roots that still belong to the app
- selecting the active runtime generation
- preparing managed config for the selected generation
- applying config/data migrations
- quarantining legacy runtime/config residue
- exposing process-match roots for stale process reaping
- publishing upgrade and migration state

In phase 1, this authority only has one concrete implementation target: `openclaw`.

### New State Files

Add a dedicated kernel authority state area under machine state, for example:

- `machine/state/kernels/openclaw/authority.json`
- `machine/state/kernels/openclaw/migrations.json`
- `machine/state/kernels/openclaw/runtime-upgrades.json`

These files become the host-owned source of truth for:

- active bundled runtime install key
- fallback runtime install key
- last successful runtime activation
- known legacy runtime roots
- quarantined legacy roots
- last config migration source and target
- last data migration source and target
- last migration error
- last activation preparation details

Host-owned runtime version information moves here. It must no longer live in the runtime-managed `openclaw.json`.

### Managed Config Ownership

The desktop host must stop treating the legacy shared path as the authoritative runtime config surface.

New rule:

- the host authority writes and owns a managed config file for the active bundled runtime generation
- `meta.lastTouchedVersion` and similar host-owned version markers are removed from the live `OpenClaw` config
- the authority stores host metadata in its own state files instead

This design does not require a full per-upgrade copy of user workspace data. It does require a dedicated authority-owned config location and explicit migration from the old compatibility file when needed.

Recommended structure:

- keep persistent managed data roots stable where safe
- move the authoritative managed config path under the kernel authority state area
- archive the legacy compatibility config after migration or keep it as a read-only fallback import source only

### Legacy Cleanup Rules

The authority must discover legacy managed runtime roots from both:

- current managed runtime roots
- old machine runtime roots already used by previous app versions

`supervisor.rs` must stop matching stale processes using only `paths.openclaw_runtime_dir`.

Instead, the authority provides a process-match specification including:

- all managed runtime roots currently owned by the app
- all legacy managed runtime roots discovered during migration
- the active managed CLI path when available

Stale-process cleanup must terminate only app-managed `OpenClaw gateway` processes under those owned roots. It must not kill unrelated user-installed external `OpenClaw` instances.

### Upgrade And Rollback Model

The current code already has partial upgrade state for components and active runtime versions, but runtime upgrade bookkeeping remains incomplete and inconsistent.

Phase 1 standardizes bundled runtime upgrade state by recording:

- current bundled runtime install key
- fallback runtime install key
- last attempted runtime activation
- last applied runtime activation
- last activation timestamp
- last activation error

`activate_runtime_version(...)` must update runtime upgrade state the same way component upgrade activation already updates component upgrade state.

Runtime activation receipts remain written under machine receipts, but they now reference the authority state record so upgrade, rollback, and migration evidence form one chain.

### Config Migration Rules

Config migration must be explicit, idempotent, and schema-aware.

Migration responsibilities:

- import the last compatible managed config if one exists
- sanitize legacy provider runtime keys already known to be invalid host-owned residue
- reapply required managed gateway defaults
- regenerate volatile runtime fields such as loopback port and token
- remove host-owned version fields from the runtime config
- persist migration metadata into the authority ledger

The authority must never silently mutate the runtime config without also updating the migration ledger.

### Data Migration Rules

Phase 1 must treat data migration separately from config generation.

Data migration scope:

- reconcile legacy managed directory layout into the new authority-owned layout
- migrate any host-owned sidecar files required by the managed bundled runtime path
- avoid destructive deletion of user data during initial migration
- quarantine replaced legacy directories instead of deleting them immediately when evidence is useful for rollback or diagnosis

The authority must support repeat startup after partial migration failure. A second run should continue or repair, not produce a new divergent layout.

### Startup Flow After Phase 1

The startup path becomes:

1. resolve bundled runtime manifest
2. ask the authority to discover current and legacy managed runtime state
3. ask the authority to prepare the activation candidate
4. authority applies pending config/data migration if required
5. authority publishes stale-process match roots
6. supervisor reaps stale app-managed gateway processes across all owned roots
7. supervisor starts the selected runtime using the authority-provided config path and environment
8. supervisor waits for readiness
9. authority records activation success or failure

This removes the current split-brain behavior where runtime install, config mutation, and stale-process cleanup all operate from different notions of ownership.

### Platform Behavior Requirements

Phase 1 must explicitly handle the different desktop platform behaviors instead of assuming the Windows runtime path is universal.

Windows requirements:

- support `ProgramData` and `USERPROFILE` based managed roots
- keep file-lock and access-denied retry behavior around runtime finalization and process replacement
- terminate stale managed process trees without relying on Unix signal behavior
- preserve `.exe`, no-window spawn, and process-group handling already used by the current supervisor

macOS requirements:

- support OS-home anchored managed roots and launch-agent service hosting
- avoid Windows-only assumptions such as `.exe` suffixes or `taskkill`
- preserve launch-agent ownership reporting through the kernel host layer
- handle case-sensitive and case-insensitive filesystem variants without path-match drift

Linux requirements:

- support OS-home anchored managed roots and systemd user service hosting
- use signal-based process shutdown semantics instead of Windows native termination
- preserve executable and path handling without Windows path normalization assumptions leaking upward
- tolerate distributions where user service state and home paths differ but still resolve to the same authority contract

The design is successful only if the authority orchestration is shared but every platform-specific primitive is delegated to the appropriate existing kernel-host or supervisor support layer.

## Phase 2: Kernel Adapter Abstraction

### Objectives

After phase 1 stabilizes `OpenClaw`, the same lifecycle path must become reusable for future kernels.

Phase 2 introduces a small, explicit contract rather than a broad generic framework for its own sake.

### Contract Shape

Add a generic adapter boundary, for example:

- `framework/kernel_runtime/mod.rs`
- `framework/kernel_runtime/types.rs`
- `framework/kernel_runtime/adapter.rs`

The key contract should cover:

- runtime identity
- bundled manifest loading
- managed config preparation
- migration planning and execution
- readiness probe strategy
- process-match roots for stale reaping
- runtime info projection

Illustrative responsibilities:

- `KernelRuntimeAdapter`
  - declares runtime id and runtime kind
  - resolves bundled payload metadata
  - prepares activation-specific environment
  - exposes migration hooks
  - exposes health and readiness strategy

- `KernelRuntimeAuthorityService`
  - common orchestration
  - activation state recording
  - runtime upgrade bookkeeping
  - shared directory and receipt conventions

- `OpenClawKernelAdapter`
  - `OpenClaw`-specific config defaults
  - `OpenClaw` CLI launch and health semantics
  - `OpenClaw` migration transforms

### Scope Boundary

Phase 2 does not require all UI surfaces to become immediately kernel-generic.

Required genericization:

- desktop runtime authority
- supervisor integration
- kernel host ownership and provenance
- runtime state and upgrade bookkeeping

Allowed to remain `OpenClaw`-specific for now:

- `OpenClaw` workbench and instance detail sections
- `OpenClaw` provider projection semantics
- `OpenClaw` gateway endpoint presentation

This keeps abstraction in the runtime core instead of forcing premature UI generalization.

## File-Level Design Impact

### `paths.rs`

Add authority-owned kernel state roots and preserve compatibility migration from legacy layout.

Expected additions include dedicated paths for:

- kernel authority state
- kernel migration state
- kernel runtime upgrade state
- authority-owned managed config location
- quarantine area for legacy runtime/config residue

### `openclaw_runtime.rs`

Reduce responsibility so it no longer directly serves as the entire runtime authority.

The `OpenClaw` layer should keep:

- bundled manifest loading
- `OpenClaw`-specific config transform helpers
- `OpenClaw` environment assembly

It should stop being the place where legacy ownership, host metadata, and upgrade state are implicitly managed.

### `supervisor.rs`

Replace hard-coded runtime-root matching with authority-provided owned roots.

The supervisor should ask the authority for:

- stale-process match roots
- authoritative managed config path
- active launch spec

### `studio.rs`

Managed bundled `OpenClaw` projection must stop reading the built-in config from one hard-coded compatibility path.

Instead it should read the currently active managed config path from the authority or from the active runtime descriptor returned by the authority-backed runtime service.

### `layout.rs` and `upgrades.rs`

Extend runtime upgrade state so runtime activation has the same evidence quality as component activation.

Runtime activation bookkeeping must include:

- last attempted version
- last applied version
- last attempted timestamp
- fallback version
- last error

## Error Handling

The authority layer must make failure states explicit instead of silently mutating local state.

Required behavior:

- migration failure records a structured authority error
- config import failure records the source path and parse cause
- stale-process cleanup failure records the remaining owned process descriptors
- activation failure records the chosen runtime generation, config path, and failure class
- partial migration does not destroy the previous known-good runtime state

## Testing Strategy

Phase 1 must add regression coverage for the confirmed field failures.

Required tests:

1. legacy runtime roots are included in stale-process discovery
2. legacy managed gateway processes under old runtime roots are reaped before new activation
3. authority migration imports legacy managed config and removes host-owned version metadata
4. runtime activation writes runtime upgrade state for the bundled runtime
5. a newer bundled runtime no longer rewrites a legacy shared config path as its authority source
6. repeated startup after partial migration failure is idempotent

Cross-platform coverage requirements:

1. authority path resolution tests cover Windows, macOS, and Linux managed layouts
2. stale-process match normalization tests prove root matching remains correct for Windows and Unix path forms
3. kernel host projection tests continue to report correct service-manager ownership for Windows Service, launchd LaunchAgent, and systemd user service paths
4. runtime launch-spec tests prove executable naming and working-directory assumptions are not Windows-only

Phase 2 must add contract tests for the new adapter boundary.

Required tests:

1. `OpenClawKernelAdapter` satisfies the generic authority contract
2. supervisor consumes authority-provided launch specs instead of `OpenClaw`-specific path assumptions
3. desktop kernel host info still projects valid runtime ownership and provenance after the adapter extraction

## Acceptance Criteria

The design is complete only when all of the following are true:

1. startup does not fail because legacy app-managed `OpenClaw` processes survive outside the current runtime root
2. bundled runtime version metadata is removed from the live managed `OpenClaw` config
3. runtime upgrade and rollback state are explicit and auditable for the bundled runtime
4. config and data migration are recorded, repeatable, and recoverable
5. the desktop lifecycle path has a stable kernel adapter boundary for future kernels
6. the authority contract runs correctly on Windows, macOS, and Linux without embedding one platform's process, path, or service assumptions into the shared lifecycle layer

## Risks

### Risk 1: Too much migration in one step

Mitigation:

- keep user data migration conservative
- quarantine legacy state before deletion
- make migration idempotent

### Risk 2: Broad `studio.rs` fallout from config path authority changes

Mitigation:

- introduce authority lookup helpers first
- convert managed bundled call sites to helper-based reads and writes
- keep external local instance discovery untouched

### Risk 3: Premature genericization

Mitigation:

- genericize the lifecycle contract, not every `OpenClaw`-specific UI detail
- keep phase 2 focused on runtime core abstractions

## Execution Order

The implementation order for this design is:

1. authority state and path model
2. stale-process reaping across current plus legacy managed roots
3. authority-owned managed config migration
4. runtime upgrade bookkeeping completion
5. managed `studio.rs` config-path conversion
6. generic kernel adapter extraction on top of the stabilized authority

This order preserves a working system at each checkpoint while converging toward the target architecture.
