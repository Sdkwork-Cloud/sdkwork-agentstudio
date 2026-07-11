> Migrated from `docs/features/overview.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Feature Overview

## Product Surface

The workspace reproduces the Agent Studio product surface from `upgrade/agent-studio-v5` while mapping responsibilities into dedicated packages and a shared dual-host shell.

## Workspace Group

- `dashboard`: operator control plane for workspace health, instances, agents, and delivery readiness
- `auth`: authentication entry and sign-in flows
- `chat`: AI chat experience
- `channels`: provider and channel views
- `tasks`: scheduled task surface
- `account`: account-focused pages

## Ecosystem Group

- `apps`: app store views
- `market`: ClawHub and skill details
- `extensions`: extension and skill package management
- `community`: posts and community flows
- `github`: GitHub repository views
- `huggingface`: Hugging Face model views

## Setup Group

- `install`: installation flows
- `instances`: instance management
- `devices`: device management
- `claw-center`: Claw Center pages

## Supporting Product Areas

- `settings`: application configuration
- `docs`: in-app documentation screens

## Why Features Are Packaged This Way

Each feature package owns its pages, components, and services. This keeps business logic close to the UI surface it serves and prevents `shell` or `business` from becoming new monoliths.

## UI Parity Goal

The migration target is functional and visual parity with `upgrade/agent-studio-v5`. Package extraction is a maintainability improvement, not a product redesign.

The approved template extension is `dashboard`, which intentionally upgrades the entry experience beyond V5 parity so new applications open on an operational control plane instead of a single feature page.

