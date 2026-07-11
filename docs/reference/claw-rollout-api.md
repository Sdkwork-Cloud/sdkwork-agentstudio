# Claw Rollout API Reference

This document captures the current rollout surface shared by desktop combined mode, the platform bridge, and the server shell.

## Contract Purpose

The rollout surface is the Phase 1 control-plane entry for node-targeted desired-state promotion.

Current TypeScript contracts live in:

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/manage.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/internal.ts`

## Management Routes

The authoritative management route family is:

- `/claw/manage/v1/rollouts/*`

Server HTTP currently exposes:

- `GET /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview`
- `POST /claw/manage/v1/rollouts/{rolloutId}:start`

The paired internal browser-facing routes are now:

- `GET /claw/internal/v1/host-platform`
- `GET /claw/internal/v1/node-sessions`

## Type Shapes

### Rollout Record

```ts
interface ManageRolloutRecord {
  id: string;
  phase:
    | 'draft'
    | 'previewing'
    | 'awaitingApproval'
    | 'ready'
    | 'promoting'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';
  attempt: number;
  targetCount: number;
  updatedAt: number;
}
```

### Rollout List

```ts
interface ManageRolloutListResult {
  items: ManageRolloutRecord[];
  total: number;
}
```

### Rollout Target List

```ts
interface ManageRolloutTargetListResult {
  rolloutId: string;
  attempt: number;
  total: number;
  items: Array<{
    nodeId: string;
    preflightOutcome: RuntimeKernelPreflightOutcome;
    blockedReason?: string | null;
    desiredStateRevision?: number | null;
    desiredStateHash?: string | null;
    waveId?: string | null;
  }>;
}
```

### Rollout Wave List

```ts
interface ManageRolloutWaveListResult {
  rolloutId: string;
  attempt: number;
  total: number;
  items: Array<{
    waveId: string;
    index: number;
    phase:
      | 'pending'
      | 'ready'
      | 'promoting'
      | 'verifying'
      | 'completed'
      | 'paused'
      | 'failed'
      | 'cancelled';
    targetCount: number;
    admissibleCount: number;
    degradedCount: number;
    blockedCount: number;
  }>;
}
```

### Rollout Preview Request

```ts
interface PreviewRolloutRequest {
  rolloutId: string;
  forceRecompute?: boolean;
  includeTargets?: boolean;
}
```

### Rollout Preview

```ts
interface ManageRolloutPreview {
  rolloutId: string;
  phase: 'previewing' | 'awaitingApproval' | 'ready' | 'failed';
  attempt: number;
  summary: {
    totalTargets: number;
    admissibleTargets: number;
    degradedTargets: number;
    blockedTargets: number;
    predictedWaveCount: number;
  };
  targets: Array<{
    nodeId: string;
    preflightOutcome: RuntimeKernelPreflightOutcome;
    blockedReason?: string | null;
    desiredStateRevision?: number | null;
    desiredStateHash?: string | null;
    waveId?: string | null;
  }>;
  candidateRevisionSummary?: {
    totalTargets: number;
    minDesiredStateRevision?: number | null;
    maxDesiredStateRevision?: number | null;
  } | null;
  generatedAt: number;
}
```

## Internal Host Status And Session Pairing

Rollout control is paired with the internal host-platform family:

- `getHostPlatformStatus()`
- `listNodeSessions()`

These contracts let the browser surface combine:

- rollout preview state
- node compatibility outcomes
- desired-state revision hashes
- host mode and lifecycle
- state-store provider and profile metadata for the current host shell

Current host-platform state-store projection shape:

```ts
interface HostPlatformStateStoreRecord {
  activeProfileId: string;
  providers: Array<{
    id: string;
    label: string;
    availability: 'ready' | 'planned';
    requiresConfiguration: boolean;
    configurationKeys: string[];
    projectionMode: 'runtime' | 'metadataOnly';
  }>;
  profiles: Array<{
    id: string;
    label: string;
    driver: 'json-file' | 'sqlite' | 'postgres';
    active: boolean;
    availability: 'ready' | 'planned';
    path?: string;
    connectionConfigured: boolean;
    configuredKeys: string[];
    projectionMode: 'runtime' | 'metadataOnly';
  }>;
}
```

Contract note:

- `stateStore` now belongs to the shared host-platform projection contract used by server mode, desktop combined mode, and the web preview bridge
- `stateStoreDriver` remains an additive host-specific hint; server currently uses values such as `json-file` and `sqlite`, while other host modes may omit it or use their own provider ids
- `projectionMode` makes the activation posture explicit: built-in runtime-backed entries use `runtime`, while the current PostgreSQL provider and profile stay `metadataOnly` until the real driver lands

## Desktop Combined Mode

Desktop combined mode does not go through the server HTTP shell. Instead it uses the same logical contract through Tauri commands implemented in:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/studio_commands.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`

Phase 1 desktop command names:

- `manage_list_rollouts`
- `manage_preview_rollout`
- `manage_start_rollout`
- `internal_get_host_platform_status`
- `internal_list_node_sessions`

## Current Server Behavior

The native server shell now provides a minimal persistence-backed rollout control-plane slice.

Current HTTP behavior:

- `GET /claw/manage/v1/rollouts` returns a JSON list loaded from `CLAW_SERVER_DATA_DIR/rollouts.json`
- `GET /claw/manage/v1/rollouts/{rolloutId}` returns one rollout record from the current catalog
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets` returns the current preview-derived per-target read model for the rollout
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` returns one target record from that same preview-derived read model
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves` returns the current preview-derived per-wave summary grouped by `waveId`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview` computes and persists a rollout preview
- `POST /claw/manage/v1/rollouts/{rolloutId}:start` requires a previously persisted preview, returns the rollout record in `promoting`, and updates the active rollout pointer used by `/claw/internal/v1/*`

Important runtime notes:

- the rollout catalog is seeded on first boot with a small default dataset
- preview generation reuses host-core preflight and desired-state projection primitives
- rollout target reads also reuse that preview generation path with `includeTargets = true`
- rollout wave reads reuse that same preview-generated target truth and aggregate wave summaries without introducing a second planner state
- non-`2xx` rollout route outcomes now return a JSON error envelope with `error.code`, `error.category`, `error.httpStatus`, `error.retryable`, `error.resolution`, `error.correlationId`, and a matching `x-claw-correlation-id` response header
- start currently rejects blocked previews and previews that have not been run yet
- when manage credentials are configured, `/claw/manage/v1/*` and the browser shell are protected by the same HTTP basic-auth challenge
- host-platform status is exposed from the same server shell under `/claw/internal/v1/host-platform`
- the host-platform `stateStore` snapshot now exposes `configurationKeys` for built-in provider profiles, `configuredKeys` for the planned PostgreSQL profile, and `projectionMode` so browser tooling can distinguish runtime-backed entries from metadata-only posture without exposing raw connection material

## Browser Surface Wiring

Browser read models now use:

- `packages/sdkwork-agentstudio-pc-core/src/services/hostPlatformService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/services/rolloutService.ts`
- `packages/sdkwork-agentstudio-pc-core/src/stores/useRolloutStore.ts`

Server-served browser bootstrap now also uses:

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webManage.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webInternal.ts`
- `packages/sdkwork-agentstudio-pc-shell/src/application/bootstrap/bootstrapShellRuntime.ts`
- `packages/sdkwork-agentstudio-pc-web/src/main.tsx`

Behavior split:

- desktop combined mode still uses Tauri commands
- plain web preview still uses the default mock bridge
- server-served browser mode reads injected `sdkwork-agentstudio-pc-host-*` metadata and switches to same-origin live `/claw/manage/v1/*` and `/claw/internal/v1/*` HTTP clients

UI surfaces:

- `packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/Nodes.tsx`

## Verification Commands

Focused verification for the rollout surface:

```bash
node --experimental-strip-types packages/sdkwork-agentstudio-pc-core/src/services/rolloutService.test.ts
node --experimental-strip-types packages/sdkwork-agentstudio-pc-core/src/stores/useRolloutStore.test.ts
node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.test.ts
```

## Current Boundaries

Implemented now:

- contract shapes for rollout list, item read, target list, preview, and start
- contract shapes for rollout target item reads
- server-side preview-derived rollout wave list reads
- machine-readable JSON error envelopes for migrated rollout route failures
- desktop combined-mode command bridge
- browser read-model and store wiring
- host-core projection, preflight, and server-side JSON persistence reuse
- server-side live `list`, item read, target read, `preview`, and `start`
- server-side live target item reads
- server-side live rollout wave reads
- browser/server-mode same-origin live bridge wiring for `manage` and `internal`

Deferred:

- approval, pause, resume, retry, rollback HTTP actions
- wave item reads and promotion or verification actions
- public `/claw/api/v1/*` rollout exposure
