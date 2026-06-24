> Migrated from `docs/release/release-2026-04-08-03.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued with an install-package root export hardening pass so the guided install wizards can consume wizard services through the package service root exactly as their component code expects.
- `removed-install-feature/src/services/index.ts` now exposes both `installGuidedWizardService` and `openClawInstallWizardService` as module namespaces instead of relying only on flattened star exports.
- The install contract gate now explicitly protects this behavior, so future edits cannot silently break guided-install UI compilation while still passing looser source-string checks.

## Attempt Outcome

- `scripts/sdkwork-install-contract.test.ts` was tightened first to require namespace exports for both wizard services.
- `packages/removed-install-feature/src/services/index.ts` was then updated to add the required `export * as ...` lines while preserving existing star exports for function-level consumers.
- A filtered `lint` rerun showed that the previous wizard-service import errors no longer appear, although the workspace still has many unrelated type failures.

## Change Scope

- `scripts/sdkwork-install-contract.test.ts`
- `packages/removed-install-feature/src/services/index.ts`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/review/step-03-install-service-index-namespace-exports-2026-04-08.md`
- `docs/release/release-2026-04-08-03.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
- `pnpm.cmd lint`
- `pnpm.cmd lint` filtered for `GuidedInstallWizard.tsx|OpenClawGuidedInstallWizard.tsx|installGuidedWizardService|openClawInstallWizardService`

## Risks And Rollback

- This iteration closes only the install wizard service root-export drift. It does not make a claim that workspace `lint` is green.
- If later work changes how install wizard modules are consumed, both the service root and the contract script must be updated together. Rolling back just the namespace exports would reintroduce the same static compile break.

