> Migrated from `docs/reference/upstream-integration.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Upstream Runtime Integration

## Goal

This document records the current runtime integration baseline for `agent-studio`.
It replaces older notes that centered desktop integration around a separate provider-router runtime.

## Current Architecture

The active desktop architecture is:

1. Tauri and the Rust host own installation, lifecycle, and bundle-time integration.
2. Desktop component services own packaged software discovery and managed installation records.
3. OpenClaw is the primary built-in runtime for local-managed desktop flows.
4. Agent Studio reads and writes provider and agent configuration through OpenClaw-compatible config files and runtime bridges.
5. Web and desktop hosts stay thin and consume package-root APIs only.

## Runtime Boundaries

- Rust host: install, upgrade, supervise, bridge commands, and expose native events
- Component services: software registry, package metadata, and install progress
- OpenClaw runtime: runtime process behavior, config authority, agent workspace, and provider configuration
- Feature packages: UI and product workflows only

## Provider Configuration Strategy

Provider configuration is now modeled as part of the OpenClaw-backed runtime and settings surfaces.
Legacy provider identifiers may still be normalized during config migration, but new product behavior must not depend on a separate router runtime or router-specific environment variables.

## Upstream Priorities

The upstream projects that still matter for Agent Studio integration planning are:

- `openclaw`
- `zeroclaw`
- `ironclaw`
- `codex`

OpenClaw remains the primary managed desktop runtime. Other runtimes can be added as managed or companion installations when the host, registry, and product flow are ready.

## Practical Rules

- Do not reintroduce standalone router-specific environment variables into tracked workspace env files.
- Do not add desktop bundle logic that assumes a separate router runtime is shipped with Agent Studio.
- Keep provider configuration migration logic centralized in shared compatibility helpers.
- Prefer config-backed and runtime-backed OpenClaw integration over package-local mock coordination.

## Notes

- Historical plans in `docs/plans` and `docs/superpowers` may still mention older router-centric exploration. They are not the current architecture source of truth.
- The current source of truth is the implementation, the contract tests, and this reference note.

