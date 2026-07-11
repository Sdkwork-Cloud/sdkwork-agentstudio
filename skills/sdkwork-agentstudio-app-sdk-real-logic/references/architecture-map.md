# Agent Studio Architecture Map

## Stack

- React + TypeScript + Vite
- pnpm's workspace with host packages and feature packages
- Tauri desktop host plus web host

## Standard Remote Path

Use this path for remote business capability:

`host -> shell/core -> feature package service or store -> core service -> declared dependency SDK or typed product app client port`

The preferred wrapper ownership is a shared core layer, not a host-only package. Concrete clients are constructed by runtime/bootstrap and injected through the standard SDKWork app composition boundary.

## Local And Native Path

Keep these concerns on their original boundaries:

- Tauri commands and platform bridges
- local files, shell processes, dialogs, device integration
- package boundary checks and workspace orchestration

Local-only capability should stay local even while adjacent business modules move to dependency SDKs, generated product SDKs, or typed product ports.

## Replace Or Remove

- `@sdkwork/agentstudio-pc-infrastructure` business HTTP calls
- raw REST helpers in feature packages
- duplicate DTO mapping that only exists to hide a missing SDK method
- host-specific backend clients that bypass the shared wrapper

## Contract Closure Rule

If a feature package needs a method that no declared dependency SDK, product SDK family, or typed product port exposes:

1. Resolve the owning application-root SDK family or dependency SDK family.
2. Fix the contract and required backend modules under that owner.
3. Regenerate through the repository-standard generator flow when generated SDK output exists.
4. Reconnect the feature package through the shared core service or typed port.
5. Delete the temporary bypass.

If that backend work would touch schema, migration, or embedded DB layout, pause and ask the user first.
