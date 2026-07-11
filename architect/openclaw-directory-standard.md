# OpenClaw Directory Standard

## Goal

This document defines the single canonical OpenClaw directory layout used by
Agent Studio desktop.

The intent is to remove path ambiguity, remove legacy config discovery, and keep
the OpenClaw user root separate from kernel governance state.

## Canonical Roots

- OpenClaw user root: `<user_root>/.openclaw`
- OpenClaw config file: `<user_root>/.openclaw/openclaw.json`
- OpenClaw runtime install root: `<install_root>/runtimes/openclaw`
- Kernel governance root: `<machine_root>/state/kernels/<runtime_id>`

## Canonical OpenClaw User Layout

```text
<user_root>/
  .openclaw/
    openclaw.json
    workspace/
      memory/
      skills/
      .openclaw/
        extensions/
    agents/
      main/
        agent/
        sessions/
    skills/
    extensions/
    cron/
    credentials/
```

## Canonical Studio Layout Around OpenClaw

```text
<user_root>/
  bin/
  .openclaw/
  user/
    auth/
    storage/
    integrations/
  studio/
    workspaces/
    backups/
  logs/
```

## Canonical Kernel Governance Layout

```text
<machine_root>/
  state/
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
    components.json
    upgrades.json
    kernels/
      openclaw/
        authority.json
        migrations.json
        runtime-upgrades.json
        quarantine/
      hermes/
        authority.json
        migrations.json
        runtime-upgrades.json
        managed-config/
          hermes.json
        quarantine/
```

## Non-Negotiable Rules

1. `openclaw.json` for the managed built-in OpenClaw runtime lives only at
   `<user_root>/.openclaw/openclaw.json`.
2. OpenClaw user data is rooted under `<user_root>/.openclaw`; do not create
   an extra `openclaw-home/` layer.
3. Kernel governance files stay under `<machine_root>/state/kernels/*`; they do
   not own the managed built-in OpenClaw user config.
4. Desktop production code must not discover config from legacy fallback paths
   such as:
   - `<data_root>/config/openclaw.json`
   - sibling stray `.openclaw` trees
   - machine-governance `managed-config/openclaw.json`
5. Workspace-scoped OpenClaw extensions live at
   `<user_root>/.openclaw/workspace/.openclaw/extensions`, which matches
   upstream OpenClaw workspace extension layout.

## Naming Rules In Code

1. Treat `<user_root>/.openclaw` as the OpenClaw root directory.
2. Do not publish separate external root semantics for "home dir" and "state
   dir" when they resolve to the same `.openclaw` path.
3. Preserve upstream `OPENCLAW_STATE_DIR` wiring internally when OpenClaw still
   expects it, but bind it to the same canonical `.openclaw` root.
4. Prefer names like `openclaw_root_dir` over names that imply an extra
   directory level that does not exist.

## Source References

- OpenClaw setup docs: `https://docs.openclaw.ai/start/setup`
- OpenClaw gateway/config docs: `https://docs.openclaw.ai/gateway/configuration`
- OpenClaw skills docs: `https://docs.openclaw.ai/skills`
- OpenClaw source tree: `https://github.com/openclaw/openclaw`
