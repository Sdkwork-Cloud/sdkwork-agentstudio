> Migrated from `docs/reports/2026-04-05-unified-deployment-architecture-current-review.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Deployment Architecture Current Review

Date: 2026-04-05

Scope:
- desktop host
- server host
- docker deployments routed through the server host
- kubernetes deployments routed through the server host
- shared instances UI, workbench load, lifecycle, and removal flows

## Execution Update

Status after implementation on 2026-04-05:
- Resolved: built-in delete actions are now hidden through shared capability gating in both list and detail views.
- Resolved: the instances list no longer fails page-wide when one `getInstanceDetail()` request fails.
- Resolved: server-backed detail now reports truthful connectivity readiness, emits `consoleAccess`, and exposes endpoint `auth` / `exposure` metadata.
- Resolved: server built-in OpenClaw detail now recovers console auth and auto-login truth from the managed `openclaw.json` workbench snapshot instead of staying permanently in `unknown auth` mode.
- Resolved: managed workbench `openclaw.json` edits are no longer overwritten on the next synchronization pass.
- Resolved: degraded workbench fallback now preserves registry deployment mode, runtime kind, storage binding, transport kind, and endpoint truth instead of rewriting everything to `custom/remote/customHttp/localFile`.
- Resolved: registry-backed metadata-only OpenClaw fallback no longer overstates management scope as `Partial runtime control`; shared overview now keeps that degraded state in `Read-only discovery`.
- Resolved: explicit `config` route semantics now override `configFile` artifact fallback, so `metadataOnly` projections can no longer be misread as attached managed OpenClaw config files by instance config/workbench flows.
- Added regression coverage for built-in, local-external, and remote OpenClaw detail parity across the hosted architecture.

Verification refresh on 2026-04-05:
- Full workspace `pnpm.cmd lint` now completes successfully in the current sandbox.
- Focused Rust and Node regression suites for OpenClaw startup, hosted browser bridges, gateway routing, and workbench hydration are also green.

Remaining low-risk follow-up:
- Full packaged installer smoke still needs end-to-end execution outside this sandbox for signed Windows / macOS / Linux artifacts.

## Status

The earlier hardening pass closed several major correctness gaps:
- unsupported lifecycle mutations no longer fake success
- server normalization now preserves remote deployment metadata
- desktop and server delete semantics are aligned
- server and desktop detail payloads now expose `lifecycleControllable`, `workbenchManaged`, and `endpointObserved`
- desktop list/detail entrypoints that the app actually uses now project built-in live state through the supervisor

The remaining issues are no longer about basic route availability. They are now concentrated in three places:
1. frontend capability gating
2. server detail projection parity
3. degraded-mode fallback truthfulness

## Findings

### 1. High: the UI still exposes delete actions for the built-in instance even though every host rejects that operation

Evidence:
- `packages/sdkwork-clawstudio-instances/src/pages/Instances.tsx:665`
- `packages/sdkwork-clawstudio-instances/src/pages/Instances.tsx:688`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx:4278`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs:1719`
- `packages/sdkwork-clawstudio-host-studio/src-host/src/lib.rs:1062`

What happens:
- The instances list always renders the uninstall action in both the online and offline dropdown branches.
- The instance detail page always renders the uninstall button.
- Desktop rejects built-in deletion with `Conflict("the built-in instance cannot be deleted")`.
- Server-backed host modes return `false` for the built-in delete request, which the frontend converts into a failure.

Why this is a bug:
- The UI advertises an action that is impossible by contract.
- The failure is deterministic, so operators experience it as a broken product path instead of a guarded capability.

Impact:
- guaranteed failure on first-launch built-in instance management
- hosted desktop, server, docker, and kubernetes all present the same bad affordance
- removal-path validation is noisy because one expected failure looks like a real regression

Recommendation:
- derive delete capability from `isBuiltIn` or an explicit delete capability flag
- hide delete affordances for the built-in record in both list and detail surfaces
- add a frontend regression test so the built-in uninstall action cannot reappear

### 2. High: one broken detail response can make the entire instances list fail to load

Evidence:
- `packages/sdkwork-clawstudio-instances/src/pages/Instances.tsx:179`
- `packages/sdkwork-clawstudio-instances/src/pages/Instances.tsx:180`
- `packages/sdkwork-clawstudio-instances/src/pages/Instances.tsx:186`

What happens:
- The list page first loads the instance list.
- It then issues a second `getInstanceDetail` request for every instance inside a single `Promise.all(...)`.
- `setInstances(data)` only runs after every detail request succeeds.
- If any one instance detail fails, the whole `try` block falls into the catch path and the page loses the entire fleet view.

Why this is a bug:
- Instance capability probing is coupled to fleet enumeration.
- A single malformed or temporarily unhealthy instance can hide unrelated healthy instances from the operator.

Impact:
- startup and load verification across mixed desktop/server/docker/kubernetes fleets becomes unreliable
- one backend detail regression can block instance removal and follow-up actions for every other instance
- large fleets pay an avoidable N+1 loading penalty before anything can render

Recommendation:
- render the list from `getInstances()` immediately
- resolve action capabilities independently with `Promise.allSettled(...)` or per-instance fallback
- treat missing detail as "capability unknown / disabled" for that one instance, not as a page-wide fatal error
- move shared action gating into a dedicated helper instead of recomputing it ad hoc in page components

### 3. High: server-backed detail still diverges from the shared architecture contract and overstates readiness

Evidence:
- `packages/sdkwork-clawstudio-host-studio/src-host/src/lib.rs:913`
- `packages/sdkwork-clawstudio-host-studio/src-host/src/lib.rs:921`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs:2375`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs:3067`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx:906`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx:925`
- `packages/sdkwork-clawstudio-instances/src/services/instanceManagementPresentation.ts:169`

What happens:
- Server detail hardcodes the only connectivity endpoint to `"status": "ready"` even when the `baseUrl` is missing or null.
- Server detail never emits `consoleAccess`, while desktop detail does for built-in, local-external, and remote OpenClaw shapes.
- The shared UI already uses `detail.consoleAccess` for "open console", management scope, and install-method presentation.

Why this is a bug:
- `server`, `docker`, and `kubernetes` are supposed to share the hosted browser architecture, but their detail payload is still materially weaker than the desktop payload.
- Endpoint readiness is being reported as a static label rather than a truthful projection from configuration presence or observed reachability.

Impact:
- shared management surfaces behave differently across deployment modes
- server-hosted remote OpenClaw instances lose console/control-plane affordances that desktop surfaces already support
- health/connectivity diagnostics can claim "ready" when the configured endpoint is absent

Recommendation:
- port the desktop connectivity and console-access projection rules into the server provider where they are host-appropriate
- never emit `"ready"` for a null or missing URL
- add parity tests that compare remote OpenClaw detail shape across desktop and server providers

### 4. Medium: degraded workbench fallback fabricates the wrong deployment topology when detail projection is unavailable

Evidence:
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts:2234`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts:2303`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts:2313`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts:2322`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts:2993`

What happens:
- When workbench code falls back to a registry-built detail snapshot, it synthesizes:
  - `owner: 'remoteService'`
  - `provider: 'localFile'`
  - `remote: false`
  - `primaryTransport: 'customHttp'`
- That fallback does not preserve the original instance deployment mode, storage binding, or transport kind.

Why this is a bug:
- The fallback path is supposed to be degraded but truthful.
- Instead, it rewrites the topology into a generic remote/custom HTTP snapshot that may not match the real instance at all.

Impact:
- load-time diagnostics can misdescribe the runtime when detail projection is absent
- workbench and management summaries become misleading exactly when the system is already degraded
- cross-mode debugging gets harder because fallback state no longer matches the source registry record

Recommendation:
- build degraded snapshots from the registry instance record without changing deployment mode, storage provider, or transport kind
- reserve synthetic labels for explicitly unknown fields only
- add a regression test for detail-missing fallback on at least one remote OpenClaw instance and one local-external OpenClaw instance

## Test Gaps

The current regression coverage is asymmetric:
- desktop has detailed remote-runtime assertions in `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs:7889` and `:7965`
- server tests around remote detail currently validate lifecycle flags and workbench nullability, but they do not assert console-access parity or truthful connectivity readiness
- the React instances pages do not have focused tests covering built-in action gating or partial-detail failure behavior

## Recommended Execution Order

1. Fix frontend action gating first.
   This removes guaranteed user-facing failures immediately and isolates built-in semantics from normal removable instances.

2. Decouple list rendering from detail probing.
   This restores fleet visibility even when one instance is broken.

3. Upgrade server detail parity.
   This is the main architecture fix for `server / docker / kubernetes`.

4. Correct degraded fallback truthfulness.
   This closes the remaining "load path lies when unhealthy" gap.

5. Add cross-mode parity tests.
   The next regression in one host mode should fail CI before it reaches the app.

