# OpenClaw v2026.4.5 Audit Plan

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Goal

Review the current `claw-studio` workspace against OpenClaw `v2026.4.5`, close implementation-only
parity gaps where possible, and record every decision, result, and blocker under `docs/step/`.

## Official Sources

- Release baseline: `https://github.com/openclaw/openclaw/releases`
- Changelog: `https://raw.githubusercontent.com/openclaw/openclaw/v2026.4.5/CHANGELOG.md`
- Control UI docs: `https://docs.openclaw.ai/web/control-ui`
- Gateway configuration reference: `https://docs.openclaw.ai/gateway/configuration-reference`

## Local Baseline

- Workspace root: `apps/claw-studio`
- Local bundled OpenClaw release metadata:
  - `config/openclaw-release.json` -> `2026.4.2`
  - `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json` -> `2026.4.2`
- Current repo state is already dirty with many user and prior-iteration changes; this audit must
  work with the existing tree and avoid unrelated rollbacks.

## Audit Modules

1. Release/runtime baseline and bundled OpenClaw version provenance
2. Control UI language surface
3. Skills / ClawHub / install-enable-disable flows
4. Memory / Dreaming / Dream Diary
5. Providers and `models.providers.<provider>.request` transport overrides
6. Channels and `contextVisibility`
7. Chat / gateway session behavior
8. Desktop / server / docker / kubernetes shared host architecture
9. Cross-operating-system release flow and smoke evidence

## Classification Rules

- `aligned`: local source and verification surface match the upstream feature intent
- `partially-aligned`: source exists but scope, evidence, or UX surface is narrower than upstream
- `blocked-by-runtime-upgrade`: upstream parity requires shipping newer bundled OpenClaw assets
- `blocked-by-live-environment`: source contracts are present but final proof needs live packaged
  execution outside this sandbox

## Execution Sequence

1. Confirm upstream `v2026.4.5` baseline from official sources.
2. Inspect local source for each module and classify the result.
3. Record the module-by-module findings in `docs/step/2026-04-07-openclaw-v2026-4-5-audit-log.md`.
4. Implement code for gaps that are purely local and do not require downloading new upstream
   runtime artifacts.
5. Run fresh verification commands after each landing step.
6. Update the audit log with verification evidence and remaining blockers.

## Current Expected High-Priority Findings

- Hard blocker: bundled OpenClaw runtime metadata is still `2026.4.2`, not `v2026.4.5`.
- Likely implementation-only gap: local Control UI language surface is narrower than upstream.
- Ongoing verification gap: packaged desktop/server/container/kubernetes smoke still needs live
  execution outside the current sandbox even though source-level contracts exist.
