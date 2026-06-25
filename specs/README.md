# Claw Studio Component Specs

This directory is the local standards index for `claw-studio`.

Root SDKWork standards remain authoritative. Local component specs can narrow or document this component, but they must not contradict [the root standards](../../sdkwork-specs/README.md).

## Component

| Field | Value |
| --- | --- |
| Name | `claw-studio` |
| Type | `app` |
| Root | `claw-studio` |
| Domain | `system` |
| Capability | `component` |
| Languages | `typescript` |
| Status | `ACTIVE` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable component contract.
- Consumers should integrate through public exports, runtime entrypoints, SDK clients, or adapters declared in the manifest.
- Generated SDK language outputs are represented at their SDK family root instead of duplicating local specs in generated folders.

## Canonical Specs

| Spec | Applies Because |
| --- | --- |
| [APP_MANIFEST_SPEC.md](../../sdkwork-specs/APP_MANIFEST_SPEC.md) | sdkwork.app.config.json application registration rules. |
| [APPLICATION_SPEC.md](../../sdkwork-specs/APPLICATION_SPEC.md) | Application shell and module composition. |
| [APP_SDK_INTEGRATION_SPEC.md](../../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md) | App SDK composition, appbase IAM runtime, and dependency SDK boundary rules. |
| [COMPONENT_SPEC.md](../../sdkwork-specs/COMPONENT_SPEC.md) | Local component specs directory and manifest rules. |
| [CONFIG_SPEC.md](../../sdkwork-specs/CONFIG_SPEC.md) | Runtime configuration, environment, SDK bootstrap, and feature flag rules. |
| [DEPLOYMENT_SPEC.md](../../sdkwork-specs/DEPLOYMENT_SPEC.md) | SaaS/private/local runtime parity and deployment rules. |
| [DOCUMENTATION_SPEC.md](../../sdkwork-specs/DOCUMENTATION_SPEC.md) | Module README, examples, ADR, changelog, and runbook rules. |
| [DOMAIN_SPEC.md](../../sdkwork-specs/DOMAIN_SPEC.md) | Canonical domain ownership and naming. |
| [FRONTEND_SPEC.md](../../sdkwork-specs/FRONTEND_SPEC.md) | UI, service, SDK, accessibility, and frontend runtime rules. |
| [GOVERNANCE_SPEC.md](../../sdkwork-specs/GOVERNANCE_SPEC.md) | Standard ownership, exception, compatibility, and migration rules. |
| [I18N_SPEC.md](../../sdkwork-specs/I18N_SPEC.md) | User-facing language, locale, message catalog, and fallback rules. |
| [MODULE_SPEC.md](../../sdkwork-specs/MODULE_SPEC.md) | Reusable package contract and dependency direction. |
| [README.md](../../sdkwork-specs/README.md) | SDKWork root standards entrypoint. |
| [SDK_SPEC.md](../../sdkwork-specs/SDK_SPEC.md) | SDK generation and SDK integration rules. |
| [TEST_SPEC.md](../../sdkwork-specs/TEST_SPEC.md) | Contract, frontend, SDK, security, parity, and documentation verification rules. |
| [CODE_STYLE_SPEC.md](../../sdkwork-specs/CODE_STYLE_SPEC.md) | Authored source structure and generated code boundaries. |
| [NAMING_SPEC.md](../../sdkwork-specs/NAMING_SPEC.md) | Canonical SDKWork naming rules. |
| [TYPESCRIPT_CODE_SPEC.md](../../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md) | TypeScript and Node package rules. |

## Public Exports

- Public exports are not declared in the package manifest.

## Dependency SDK Clients

- `@sdkwork/iam-app-sdk` from `../sdkwork-iam/sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi`.
- `@sdkwork/drive-app-sdk` from `../sdkwork-drive/sdks/sdkwork-drive-app-sdk/sdkwork-drive-app-sdk-typescript`.
- `@sdkwork/messaging-app-sdk` from `../sdkwork-messaging/sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/generated/server-openapi`.
- `@sdkwork/local-api-proxy` from `../sdkwork-local-router/packages/pc-react/intelligence/sdkwork-local-api-proxy`.

## Local Extension Specs

- No local extension specs are declared yet.

## Verification

- `pnpm --filter @sdkwork/claw-workspace build`
