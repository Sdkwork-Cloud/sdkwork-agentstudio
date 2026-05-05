# Chat, Instance, and Kernel Stability Design

## Goal

Repair four confirmed product-blocking defects in the retained commercial surface without reopening removed product areas. The scope is limited to `chat`, `instance` lifecycle/detail behavior, and `kernel` runtime consistency.

## Scope

The repair pass covers these defects:

1. `InstanceDetail` violates React hooks ordering because `useMemo` is declared after loading and not-found early returns.
2. `chat` still exposes model selection and send/session flows for `unsupported` instance routes, creating false-positive chat readiness.
3. `instance` lifecycle action capabilities disagree on `starting` state, causing incorrect `Start` affordances while the instance is already booting.
4. `kernel` action cache invalidation clears kernel status/info caches but leaves runtime-info cache stale, allowing mixed dashboard snapshots after lifecycle actions.

Out of scope:

- Any retired chat product work
- App store, market, GitHub, HuggingFace, points, mall, or e-commerce surfaces already removed from this repo
- New features or broad refactors unrelated to the four defects

## Recommended Approach

Use a minimum-closure repair strategy:

- Fix the authoritative behavior at the narrowest shared abstraction that owns it.
- Add regression tests first for each defect.
- Avoid speculative refactors while the workspace is intentionally dirty from unrelated product simplification work.

This is preferred over a broad cleanup because the current repo state already contains large deliberate deletions outside the target scope. Expanding the edit surface would materially raise merge and regression risk.

## Design

### 1. Instance Detail Hooks Safety

Move all hooks in `InstanceDetail.tsx` ahead of early returns. The page should resolve a safe detail module/page/source before branching into loading, not-found, or unsupported rendering. The memoized detail source can be constructed against fallback values and only consumed when the supported detail module is present.

Because the current workspace does not ship a browser-runtime React test harness for this page, the regression guard will be a source contract test that enforces the hook ordering invariant in the route component.

### 2. Unified Chat Readiness

Treat `unsupported` routes as not chat-capable across the whole chat flow:

- `instanceEffectiveModelCatalogCore` returns an empty catalog for unsupported routes instead of router fallback models.
- `chatSessionBootstrap` does not auto-create or auto-select direct sessions for unsupported instance routes.
- `Chat.tsx` rejects send attempts when the resolved route mode is `unsupported`.
- `ChatSidebar` suppresses new-session creation when the current instance route is unsupported.

This preserves the existing authoritative route service and keeps the UI aligned with the lower-level runtime truth.

### 3. Lifecycle Capability Matrix Consistency

Make `instanceActionCapabilities` match the already-correct semantics used by `instanceBaseDetail`:

- `starting`: `canStart = false`, `canStop = true`, `canRestart = true`
- `online`: `canStart = false`, `canStop = true`, `canRestart = true`
- `offline`: `canStart = true`, `canStop = false`, `canRestart = false`

This keeps list and detail surfaces consistent and prevents impossible actions during startup.

### 4. Kernel and Runtime Cache Coherency

Kernel lifecycle actions in `registry.ts` must invalidate both kernel caches and runtime-info caches. The dashboard composes both sources in `kernelCenterService`, so cache invalidation has to happen in the shared registry layer rather than trying to special-case consumers.

## Verification

Verification will use the existing package-level checks:

- `pnpm check:sdkwork-chat`
- `pnpm check:sdkwork-instances`
- `pnpm check:sdkwork-settings`
- `pnpm check:sdkwork-foundation`

Targeted single-test runs will be used during TDD before the package-level checks.

## Risks

- The workspace is already dirty with user-directed product removals; only the files in the retained chat/instance/kernel path should be touched.
- The `InstanceDetail` regression guard is source-based rather than DOM-runtime-based due current repo test harness constraints.
