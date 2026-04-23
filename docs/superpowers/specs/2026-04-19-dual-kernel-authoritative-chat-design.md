# Dual-Kernel Authoritative Chat Design

## Status

Approved implementation baseline.

## Goal

Define one authoritative kernel chat standard for Claw Studio so the application can talk directly to built-in or attached `OpenClaw` and `Hermes` runtimes without reintroducing Studio-local chat truth.

The standard must cover:

- kernel-native `agent`, `session`, `run`, and `message` abstractions
- kernel capability discovery
- kernel runtime ownership modes
- kernel distribution and installation surfaces
- cross-platform Hermes support boundaries

## Hard Constraints

- This is a hard cut for a new application. Compatibility shims are not required.
- `OpenClaw` and `Hermes` must both enter chat through one shared shell and one shared domain model.
- Session truth and transcript truth must remain inside the owning kernel.
- Studio-local chat persistence may cache or project state, but it must never become authoritative truth for instance-scoped kernel chat.
- Kernel configuration authority must use the kernel `user_root` standard and must not revive dual config systems.
- Runtime management must not be mixed into chat adapter interfaces.

## External References

- Hermes installation support: `Linux`, `macOS`, and `WSL2`, with Docker-supported terminal/runtime usage.
  - `https://hermes-agent.nousresearch.com/docs/getting-started/installation/`
- Hermes authoritative session storage and state database:
  - `https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage/`
- Hermes session user model:
  - `https://hermes-agent.nousresearch.com/docs/user-guide/sessions/`
- OpenClaw authoritative session and gateway model:
  - `https://docs.openclaw.ai/web/tui`
  - `https://docs.openclaw.ai/web/webchat`

## Problem Statement

Claw Studio already has the beginning of a multi-kernel chat architecture:

- shared `KernelChat*` types exist
- the chat page is adapter-first
- OpenClaw gateway chat is partially projected into kernel-native sessions/messages
- Hermes already appears in the adapter registry

However the current model is incomplete:

- Hermes chat is still a placeholder with no authoritative `session/message/run` bridge
- runtime ownership and distribution are not standardized beside chat
- capability-driven rendering is not fully formalized
- shared chat models do not yet capture enough native metadata to support both OpenClaw and Hermes cleanly

## Recommended Approach

Keep one unified chat shell and split kernel standardization into three layers:

1. `KernelChat`
2. `KernelRuntimeAuthority`
3. `KernelDistribution`

This keeps boundaries explicit:

- chat answers "how do we talk to the kernel?"
- runtime answers "who owns the running process or service?"
- distribution answers "where do installable artifacts come from and how are they staged?"

## Rejected Alternatives

### Per-Kernel Chat Pages

Rejected because a separate `OpenClaw` page and `Hermes` page would duplicate transcript UI, session UX, and capability rendering while making the third kernel integration harder.

### Transport-First Chat Abstraction

Rejected because transport-first models collapse durable kernel identity into HTTP/WebSocket concerns and cannot correctly model OpenClaw gateway authority or Hermes SQLite session authority.

### One Monolithic Kernel Interface

Rejected because installation, runtime lifecycle, and chat authority change for different reasons and need different evolution paths.

## Layer 1: KernelChat

`KernelChat` is the only domain the chat shell consumes.

### KernelChat Domain Objects

The shared domain must standardize:

- `KernelChatAgentProfile`
- `KernelChatSessionRef`
- `KernelChatSession`
- `KernelChatRun`
- `KernelChatMessage`
- `KernelChatMessagePart`
- `KernelChatCapabilitySet`

### KernelChatSessionRef

`KernelChatSessionRef` must keep both platform identity and kernel-native identity.

Required fields:

- `kernelId`
- `instanceId`
- `sessionId`

Optional but important fields:

- `nativeSessionId`
- `routingKey`
- `agentId`
- `lineageParentSessionId`

Rules:

- `sessionId` is the stable Studio-facing id for the adapter projection.
- `nativeSessionId` is the kernel-owned durable id when different.
- `routingKey` is kernel-owned routing identity when present.
- `lineageParentSessionId` is used for kernels that model forks or continuation chains.

### KernelChatSession

`KernelChatSession` remains the session summary object for list and header surfaces.

Required fields:

- `ref`
- `authority`
- `lifecycle`
- `title`
- `createdAt`
- `updatedAt`
- `messageCount`

Optional fields:

- `lastMessagePreview`
- `sessionKind`
- `actorBinding`
- `modelBinding`
- `capabilities`
- `activeRunId`
- `nativeMetadata`

`nativeMetadata` is a kernel-neutral record for non-lossy projection of runtime-specific session fields.

### KernelChatRun

`KernelChatRun` stays separate from messages and models execution truth.

Required fields:

- `id`
- `sessionRef`
- `status`
- `createdAt`
- `updatedAt`
- `abortable`

Optional fields:

- `label`
- `nativeMetadata`

### KernelChatMessage

`KernelChatMessage` remains the durable transcript item.

Required fields:

- `id`
- `sessionRef`
- `role`
- `status`
- `createdAt`
- `updatedAt`
- `text`
- `parts`

Optional fields:

- `runId`
- `model`
- `senderLabel`
- `nativeMetadata`

### KernelChatMessagePart

Supported part kinds remain:

- `text`
- `reasoning`
- `toolCall`
- `toolResult`
- `attachment`
- `notice`

Rules:

- reasoning must remain structured
- tool traces must remain structured
- attachments must remain first-class
- kernel-specific content must not be flattened into markdown-only strings

### KernelChatCapabilitySet

The chat shell must render from capabilities instead of kernel-specific conditionals.

The first-party capability set includes:

- `supportsAgentProfiles`
- `supportsSessionMutation`
- `supportsStreaming`
- `supportsRuns`
- `supportsRunAbort`
- `supportsModelSelection`
- `supportsReasoningControl`
- `supportsThinkingLevel`
- `supportsFastMode`
- `supportsVerboseLevel`
- `supportsAttachments`

The chat shell may also expose:

- `sessionMetadataPanels`
- `messagePartKinds`
- `composerAffordances`

## Layer 2: KernelRuntimeAuthority

`KernelRuntimeAuthority` describes who owns lifecycle and observability for a running kernel.

### Runtime Modes

The initial standard modes are:

- `localManaged`
- `localAttached`
- `wslManaged`
- `dockerManaged`
- `remoteAttached`

### Runtime Rules

- `OpenClaw` may use `localManaged`, `localAttached`, or `remoteAttached`.
- `Hermes` may use `localManaged`, `localAttached`, `wslManaged`, `dockerManaged`, or `remoteAttached`.
- `Windows` native managed Hermes is explicitly unsupported.
- `Kubernetes` support is represented as `remoteAttached`, not as a desktop-owned built-in runtime.

## Layer 3: KernelDistribution

`KernelDistribution` describes where runtime artifacts come from and how Studio installs them.

Required concerns:

- release source identity
- version resolution
- package target resolution
- install plan generation
- staging root selection
- upgrade policy
- doctor policy

Rules:

- `OpenClaw` may keep the existing bundled/runtime release governance model.
- `Hermes` distribution must reflect the official platform surface instead of pretending native Windows support exists.
- Distribution data must stay separate from runtime ownership and separate from chat authority.

## Kernel Support Matrix

### OpenClaw

- Desktop bundled managed runtime: supported
- Desktop attached runtime: supported
- Remote attached runtime: supported

### Hermes

- `Ubuntu/Linux`: managed or attached
- `macOS`: managed or attached
- `Windows`: `WSL2` managed or attached only
- `Docker`: managed container runtime
- `Kubernetes`: remote attached deployment target

## Configuration Authority

### OpenClaw

- user root: `~/.openclaw`
- config file: `~/.openclaw/openclaw.json`

### Hermes

- user root: `~/.hermes`
- config file: `~/.hermes/config.yaml`
- state database: `~/.hermes/state.db`
- sessions directory: `~/.hermes/sessions/`
- logs directory: `~/.hermes/logs/`

Rules:

- The kernel `user_root` is the only configuration authority.
- Managed runtime caches may exist outside `user_root`, but they must not become config authority.
- No second managed-config tree is allowed.

## UI Standard

The chat experience remains one unified shell:

- left: session list
- center: transcript
- bottom: composer
- right: capability panel

Shared shell behavior:

- list/create/rename/delete sessions
- stream transcript updates
- render message parts
- expose run state
- allow model changes when capabilities permit

Kernel-specific behavior appears only through capability-driven panels:

- `OpenClaw`: agent, thinking level, fast mode, reasoning, verbose level
- `Hermes`: native session/profile/model capabilities as they are wired

## Implementation Strategy

1. Harden shared `KernelChat*` types to carry non-lossy native metadata and formal capability sets.
2. Introduce shared `KernelRuntimeAuthority` and `KernelDistribution` models.
3. Keep OpenClaw on the same chat shell but route all kernel-specific controls through capabilities.
4. Replace the Hermes placeholder adapter with a real authoritative adapter surface and a clear unsupported/partial contract where upstream runtime APIs are not yet available.
5. Wire Hermes install/runtime support through the runtime/distribution layers instead of leaking it into chat code.

## Success Criteria

- Studio can resolve `OpenClaw` and `Hermes` through one authoritative chat shell.
- Session/message/run truth for instance-scoped chat is always kernel-owned.
- Hermes support boundaries are explicit and match official upstream support.
- Kernel config authority remains rooted in per-kernel `user_root`.
- Adding a third kernel requires a new adapter/runtime/distribution implementation, not a new page architecture.
