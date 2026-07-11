> Migrated from `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Rust Host Runtime Hardening Smoke

Date: 2026-04-05

Scope:
- desktop embedded host
- hosted browser bridge
- standalone server host
- docker deployment contracts
- kubernetes deployment contracts
- shared OpenClaw instance, config, conversation, task, and readiness flows

## Summary

This smoke pass focused on the runtime-authority regressions identified in the follow-up review and the Phase 2 hardening plan.

Confirmed outcomes:

- inactive server/container control planes no longer project `local-built-in` as a writable managed workbench
- hosted/browser managed OpenClaw config mutations now reuse gateway authority for raw config, agents, channels, web search, auth cooldowns, and channel enablement whenever the runtime is online
- hosted/browser conversation snapshots no longer override managed OpenClaw runtime truth when the built-in runtime is unavailable
- `/claw/health/ready` is runtime-aware instead of always returning `200`
- the Helm deployment now probes `/claw/health/ready`
- the Helm chart rejects `replicaCount > 1` until shared multi-replica runtime coordination exists
- server public workbench mutation routes now return an explicit conflict contract when no live managed workbench authority is attached

## Automated Verification

Commands executed on 2026-04-05:

- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml built_in`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:sdkwork-host-runtime`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml health`
- `node scripts/release-deployment-contract.test.mjs`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml public_studio_workbench`
- `pnpm.cmd check:server`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-core/src/services/openClawConfigService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd lint`

Result:

- all commands above passed after the hardening changes landed

## Smoke Matrix

| Flow | Mode | Evidence | Result |
| --- | --- | --- | --- |
| Built-in OpenClaw managed projection withheld when runtime is inactive | server / docker / k8s | `cargo test ... built_in`, `pnpm.cmd check:sdkwork-host-runtime` | Pass |
| Hosted browser config workbench uses gateway authority when runtime is online and file fallback only for offline desktop flows | hosted browser + desktop local fallback | `pnpm.cmd check:sdkwork-host-runtime` | Pass |
| Hosted/browser managed OpenClaw agent, channel, web search, auth cooldown, and channel-toggle mutations use gateway authority when runtime is online | hosted browser + desktop local fallback | `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`, `node --experimental-strip-types packages/sdkwork-agentstudio-pc-core/src/services/openClawConfigService.test.ts` | Pass |
| Hosted/browser conversation list does not fall back to stale snapshot truth for offline managed OpenClaw | hosted browser | `pnpm.cmd check:sdkwork-host-runtime` | Pass |
| Server public workbench task/file/provider routes reject built-in mutations without live runtime authority | server | `cargo test ... public_studio_workbench`, `pnpm.cmd check:server` | Pass |
| Runtime-aware readiness endpoint returns non-ready when runtime authority is missing | server / docker / k8s | `cargo test ... health`, `pnpm.cmd check:server` | Pass |
| Kubernetes readiness probe targets `/claw/health/ready` | kubernetes | `node scripts/release-deployment-contract.test.mjs` | Pass |
| Kubernetes multi-replica installs are explicitly guarded | kubernetes | `node scripts/release-deployment-contract.test.mjs` | Pass |

## Manual Runtime Flows

The following flows were not executed as live packaged/manual runs in this sandboxed workspace because they require desktop binaries or external runtimes:

- desktop packaged startup with bundled OpenClaw launch
- desktop hosted HTTP vs Tauri direct parity against a live supervisor
- docker runtime launch and readiness against a real container
- kubernetes Helm install against a live cluster

Current status for those flows:

- contract coverage is present and passing
- live manual execution is still required outside this sandbox to record packaged/runtime screenshots and endpoint traces

## Follow-up Manual Checklist

Run these flows on a real target machine before release:

1. Desktop packaged build:
   - install package
   - verify bundled OpenClaw is expanded during install, not during first boot
   - verify app startup shows `local-built-in` as `online`
   - verify OpenClaw console opens and websocket is reachable
2. Desktop hosted parity:
   - compare Tauri direct instance detail with hosted `/claw/api/v1/studio/instances/local-built-in`
   - compare Tauri direct OpenClaw runtime/gateway status with hosted `/claw/manage/v1/openclaw/runtime` and `/claw/manage/v1/openclaw/gateway`
3. Browser/server config workbench:
   - load managed config document
   - save a change
   - verify the change goes through gateway authority and survives reload
4. Chat and conversation parity:
   - create a session
   - send a free chat turn
   - verify conversation list and detail reflect runtime truth
5. Cron/task parity:
   - create, edit, clone, run, pause, and delete a task in desktop combined mode
   - verify hosted browser mode does not expose writable built-in workbench controls unless live authority is attached
6. Docker and singleton-k8s:
   - verify `/claw/health/live` stays `200`
   - verify `/claw/health/ready` reflects runtime availability
   - verify k8s render/install rejects `replicaCount > 1`

## Remaining Gaps

- No live packaged desktop smoke evidence is attached yet.
- No live docker/k8s runtime traces are attached yet.
- Phase 2 hardening contracts are in place, but release readiness still needs real-environment smoke execution.

