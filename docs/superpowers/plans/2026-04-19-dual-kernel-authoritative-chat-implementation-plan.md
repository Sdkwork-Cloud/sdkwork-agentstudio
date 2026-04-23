# Dual-Kernel Authoritative Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land one authoritative chat/kernel standard so Claw Studio can directly talk to kernel-owned `OpenClaw` and `Hermes` agent frameworks through shared `agent/session/run/message` abstractions.

**Architecture:** Extend the existing adapter-first chat cut instead of rewriting it. Shared `KernelChat*` types become the hard contract, then add explicit runtime/distribution models for kernel lifecycle and platform support. `OpenClaw` stays gateway-authoritative, while `Hermes` moves from placeholder status to a real standardized kernel surface with explicit platform/runtime constraints.

**Tech Stack:** TypeScript, React, Zustand, existing Claw Studio package boundaries, Node strip-types tests, Tauri/Rust host integration points, official Hermes/OpenClaw runtime models.

---

### Task 1: Harden Shared Kernel Domain Types

**Files:**
- Modify: `packages/sdkwork-claw-types/src/kernelChatModel.ts`
- Modify: `packages/sdkwork-claw-types/src/kernelChatModel.test.ts`
- Modify: `packages/sdkwork-claw-types/src/kernelModel.ts`
- Modify: `packages/sdkwork-claw-types/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that require:

```ts
assert.deepEqual(createKernelChatCapabilitySet({
  supportsStreaming: true,
  supportsRuns: true,
}).supportsRunAbort, false);

assert.equal(
  createKernelChatSessionRef({
    kernelId: 'hermes',
    instanceId: 'instance-hermes',
    sessionId: 'session-1',
    lineageParentSessionId: 'session-root',
  }).lineageParentSessionId,
  'session-root',
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types packages/sdkwork-claw-types/src/kernelChatModel.test.ts`

Expected: FAIL because the new capability/native metadata fields do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add:

- `KernelChatCapabilitySet`
- `createKernelChatCapabilitySet(...)`
- `nativeMetadata` on session/run/message
- `lineageParentSessionId` on `KernelChatSessionRef`
- runtime/distribution-facing kernel model extensions where needed

- [ ] **Step 4: Run tests to verify they pass**

Run the updated type test file again.

### Task 2: Standardize Hermes Path And Runtime Support Contracts

**Files:**
- Modify: `packages/sdkwork-claw-core/src/services/hermesPathResolutionService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hermesPathResolutionService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hermesKernelConfigPathService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/hermesKernelConfigPathService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/services/kernelConfigDiscoveryService.ts`
- Modify: `packages/sdkwork-claw-core/src/services/kernelConfigDiscoveryService.test.ts`

- [ ] **Step 1: Write the failing tests**

Require Hermes standard roots:

```ts
assert.equal(resolveHermesUserRoot('/Users/admin/.hermes/config.yaml'), '/Users/admin/.hermes');
assert.equal(resolveHermesStateDb('/Users/admin/.hermes/config.yaml'), '/Users/admin/.hermes/state.db');
assert.equal(resolveHermesSessionsRoot('/Users/admin/.hermes/config.yaml'), '/Users/admin/.hermes/sessions');
```

- [ ] **Step 2: Run tests to verify they fail**

Run each updated Hermes path/config test.

Expected: FAIL because state/log/session roots are not fully standardized yet.

- [ ] **Step 3: Write minimal implementation**

Make Hermes path resolution always derive from `user_root/.hermes` and expose:

- config root
- config file
- state db
- sessions root
- logs root

- [ ] **Step 4: Run tests to verify they pass**

Re-run the updated Hermes path/config tests.

### Task 3: Upgrade The Adapter SPI To Full Authoritative Capability-Driven Chat

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAdapter.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAdapter.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAdapterRegistry.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAdapterRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

Add assertions that adapters expose a typed capability set and that Hermes/OpenClaw registry resolution returns kernel-native authority semantics.

- [ ] **Step 2: Run tests to verify they fail**

Run the adapter SPI and registry tests.

- [ ] **Step 3: Write minimal implementation**

Extend adapter capabilities to carry:

- shared capability set
- authoritative reason/not-ready reason
- runtime authority hints where needed

- [ ] **Step 4: Run tests to verify they pass**

Re-run the adapter tests.

### Task 4: Replace The Hermes Placeholder With A Real Authoritative Adapter Surface

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/services/adapters/hermesKernelChatAdapter.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/adapters/hermesKernelChatAdapter.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/authoritativeKernelChatAdapter.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.test.ts`

- [ ] **Step 1: Write the failing tests**

Require Hermes to expose authoritative SQLite semantics plus real session/message lifecycle surface shape:

```ts
const adapter = createHermesKernelChatAdapter({...});
assert.equal(adapter.getCapabilities().authorityKind, 'sqlite');
assert.equal(adapter.getCapabilities().capabilitySet.supportsSessionMutation, true);
assert.equal(typeof adapter.listSessions, 'function');
assert.equal(typeof adapter.loadMessages, 'function');
```

- [ ] **Step 2: Run tests to verify they fail**

Run the Hermes adapter tests.

- [ ] **Step 3: Write minimal implementation**

Replace the placeholder with:

- authoritative Hermes capability model
- explicit unsupported partial methods only where upstream runtime integration is not yet available
- dependency injection points for session listing, message loading, session creation, and run start/abort

- [ ] **Step 4: Run tests to verify they pass**

Re-run the Hermes adapter tests.

### Task 5: Make The Unified Chat Shell Capability-Driven Instead Of OpenClaw-Conditional

**Files:**
- Modify: `packages/sdkwork-claw-chat/src/pages/Chat.tsx`
- Modify: `packages/sdkwork-claw-chat/src/pages/chatPageComposition.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatSessionState.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatSessionState.test.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatMessageState.ts`
- Modify: `packages/sdkwork-claw-chat/src/services/kernelChatMessageState.test.ts`

- [ ] **Step 1: Write the failing tests**

Require the chat page to render kernel-specific controls from capability data instead of direct `isOpenClawGateway` conditionals wherever the new standard covers the control.

- [ ] **Step 2: Run tests to verify they fail**

Run the page/state tests.

- [ ] **Step 3: Write minimal implementation**

Move shell decisions to capability-driven logic:

- common shell always on
- OpenClaw panel derives from capability set
- Hermes panel can render authoritative-but-partial capability status cleanly

- [ ] **Step 4: Run tests to verify they pass**

Re-run the page/state tests.

### Task 6: Verify Runtime And Package Boundaries

**Files:**
- Modify: `scripts/run-sdkwork-chat-check.mjs`
- Modify: `scripts/sdkwork-core-contract.test.ts`
- Modify: `scripts/sdkwork-foundation-contract.test.ts`
- Modify: `scripts/sdkwork-host-runtime-contract.test.ts`

- [ ] **Step 1: Write the failing checks**

Add assertions that:

- Hermes config authority resolves from `user_root`
- chat remains adapter-first
- no Studio-local durable chat truth is reintroduced
- Hermes platform support is explicit and truthful

- [ ] **Step 2: Run targeted verification to verify it fails**

Run the affected contract tests.

- [ ] **Step 3: Write minimal implementation**

Update contracts and integration points to reflect the new standard.

- [ ] **Step 4: Run targeted verification to verify it passes**

Run:

- `pnpm check:sdkwork-chat`
- `pnpm check:sdkwork-core`
- `pnpm check:sdkwork-host-runtime`

### Task 7: Final Workspace Verification

**Files:**
- Modify only what earlier tasks require

- [ ] **Step 1: Run final workspace checks**

Run:

- `pnpm lint`
- `pnpm build`
- `git diff --check`

- [ ] **Step 2: Fix any failing regressions**

Keep fixes minimal and scoped to the new kernel standard work.

- [ ] **Step 3: Confirm result**

Record the final command outcomes and summarize:

- landed domain changes
- Hermes support boundary
- OpenClaw/Hermes chat authority behavior
