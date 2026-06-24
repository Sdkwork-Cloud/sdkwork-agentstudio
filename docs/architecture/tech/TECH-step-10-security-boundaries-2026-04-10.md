> Migrated from `docs/review/step-10-安全默认值与暴露边界-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 10 Security Defaults And Exposure Boundaries - 2026-04-10

## Scope

- Step: `10`
- Checkpoint focus:
  - `CP10-1`
  - `CP10-3`
- Current loop goal:
  - freeze the current security-default posture as executable evidence
  - remove stale deployment and startup-contract assumptions that could weaken the release boundary by drift

## Frozen Boundary Decisions

- Server host binding remains loopback by default.
- Public bind remains an explicit insecure opt-in and still requires manage credentials before the host is considered valid.
- Packaged container bundle commands are frozen to the real `deploy/docker/*` bundle layout rather than legacy flat `deploy/*` assumptions.
- Desktop bootstrap may read only `kernel.getInfo().localAiProxy` as startup evidence for the persisted `desktop-startup-evidence.json` document.
- Desktop bootstrap may not expand that read into broader `kernelInfo.*` truth, because readiness, manage endpoint authority, and built-in OpenClaw identity must still come from the hosted runtime readiness contract.

## Root Cause

- The security model itself was already mostly correct in runtime code, but Step 10 still had two drift classes:
  - stale release/deployment docs and contract tests described the wrong packaged bundle command surface
  - an older host-runtime contract prohibited the now-approved local proxy startup-evidence read, which made the enforced boundary diverge from the approved Step 09 truth chain

## Implemented Fix

- `scripts/release-deployment-contract.test.mjs` now locks the packaged operator surface to:
  - `deploy/docker/docker-compose.yml`
  - `deploy/docker/docker-compose.nvidia-cuda.yml`
  - `deploy/docker/docker-compose.amd-rocm.yml`
  - `deploy/docker/Dockerfile`
- `deploy/docker/README.md`, `docs/core/release-and-deployment.md`, and `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md` now document the same packaged path layout instead of stale flat paths.
- `scripts/sdkwork-host-runtime-contract.test.ts` now freezes the desktop bootstrap boundary as:
  - allowed: `const kernelInfo = await getDesktopKernelInfo(); const localAiProxy = kernelInfo?.localAiProxy ?? null;`
  - disallowed: any broader `kernelInfo.*` shell read in `connectDesktopRuntime`

## Supporting Evidence

- `pnpm.cmd check:server` proved the host-side security defaults remain active:
  - `build_server_state_defaults_to_loopback_host`
  - `build_server_state_rejects_public_bind_without_control_plane_credentials`
  - `build_server_state_allows_public_bind_when_explicitly_opted_in`
- `pnpm.cmd check:desktop` proved the desktop-side authority boundary remains tied to canonical readiness instead of route presence alone:
  - canonical manage endpoint selection
  - built-in OpenClaw websocket/baseUrl drift rejection
  - `desktop-local-ai-proxy-contract` green
  - `prepare-openclaw-runtime.test.mjs` green on Windows without external `tar`
- `pnpm.cmd check:sdkwork-host-runtime` proved the shell bootstrap boundary now matches the approved startup-evidence flow and still blocks unrelated kernel reads.

## Result

- The Step 10 security-default surface is now executable and auditable across:
  - server runtime config
  - desktop startup bootstrap
  - packaged deployment docs
  - release/deployment contract tests
- No remaining Step 10 blocker depends on human interpretation of path layout or bootstrap authority.

## Closure Status

- `CP10-1`: green
- `CP10-3`: green

The remaining Step 10 work was not about inventing stronger defaults; it was about freezing the already-approved defaults into gates. That closure is now complete.

