# SDKWork HTTP Boundary Classification

Date: 2026-06-06

Scope: Claw Studio raw transport, manual auth-header, and retired SDK references after the SDKWork appbase, Drive, messaging, local-router, and IAM runtime realignment.

Standards used:

- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/SDK_SPEC.md`
- `../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md`
- `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`
- `../sdkwork-specs/SECURITY_SPEC.md`

## Outcome

The retired `retired generic app SDK package` package is not a valid workspace dependency in this repository. It must not be reintroduced as a fake local package, a local SDK fork, or a raw HTTP compatibility wrapper.

Appbase login, registration, session refresh, logout, OAuth, QR auth, password reset, and verification-code flows are no longer classified as raw HTTP. `packages/sdkwork-claw-core/src/services/appAuthService.ts` delegates to `@sdkwork/auth-pc-react/auth-service`, `@sdkwork/appbase-app-sdk`, and `@sdkwork/messaging-app-sdk`.

## Fixed SDKWork API Bypasses

`packages/sdkwork-claw-core/src/services/appAuthService.ts`

- Classification: fixed SDKWork auth/session bypass.
- Current status: uses the appbase auth wrapper and injected messaging verification-code client.
- Rule: keep this free of `fetch(`, `resolveAppSdkApiUrl`, manual `Authorization`, manual `Access-Token`, and retired `retired generic app SDK package` imports.

`packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts`

- Classification: unresolved product SDK authority, with raw HTTP fallback removed.
- Current status: accepts an injected product app SDK client factory or approved composed app client. The default resolver fails closed until the owning product SDK authority is identified.
- Rule: do not import `retired generic app SDK package`, do not call `postJson`, and do not add an update-check raw HTTP fallback.

## Unresolved Product SDK Authority

The following services still represent Claw product/business app-api capability. They are not backed by an identified Claw-owned SDK family under `claw-studio/sdks/`, and no current sibling repository exposes these product resources as a generated dependency SDK. They therefore remain an unresolved product SDK authority gap, not an appbase capability.

`packages/sdkwork-claw-core/src/sdk/appSdkPort.ts`

- Classification: local structural product SDK port.
- Current status: owns the narrow service-facing TypeScript ports for skill, feedback, order, product, and related product resources.
- Rule: this is a temporary typed boundary only. Replace it with a generated or approved composed Claw product SDK surface when the product API authority is available.

`packages/sdkwork-claw-core/src/services/communityService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural feed/comment/category client ports through `getClawStudioAppClientWithSession`.
- Rule: do not add raw HTTP for feed, comment, or category resources.

`packages/sdkwork-claw-core/src/services/accountService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural account client ports through `getClawStudioAppClientWithSession`.
- Rule: do not replace account summary, cash, recharge, or withdraw calls with raw HTTP.

`packages/sdkwork-claw-core/src/services/settingsService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural user self-service ports for legacy Claw settings behavior.
- Rule: when this becomes appbase current-user self-service, move it to `appbaseApp.iam.users.current.*`; otherwise keep it behind a product SDK port and do not add raw HTTP.

`packages/sdkwork-claw-core/src/services/clawHubService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural skill client ports through `getClawStudioAppClientWithSession`.
- Rule: do not revive `retired generic app SDK package` or implement skill catalog calls with raw HTTP.

`packages/sdkwork-claw-core/src/services/feedbackCenterService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural feedback and FAQ client ports through `getClawStudioAppClientWithSession`.
- Rule: do not implement feedback or FAQ resources with raw HTTP.

`packages/sdkwork-claw-core/src/services/dashboardCommerceService.ts`

- Classification: unresolved product SDK authority.
- Current status: uses injected structural order and product client ports through `getClawStudioAppClientWithSession`.
- Rule: do not implement order or product resources with raw HTTP.

`packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts`

- Classification: unresolved product SDK authority.
- Current status: requires an injected product app SDK client factory for app update checks.
- Rule: keep the fail-closed default until a generated product update SDK or approved composed client exists.

## Local/provider boundary

These sites use raw transport for local runtime, host adapter, or provider endpoints. They are not SDKWork app-api/backend-api SDK bypasses in the current architecture.

`packages/sdkwork-claw-core/src/lib/llmService.ts`

- Classification: local/provider boundary.
- Reason: calls the active AI-compatible instance selected by the Claw runtime. The manual bearer header belongs to the selected provider or local instance connection, not the SDKWork app login TokenManager.
- Guardrail: do not reuse this pattern for SDKWork appbase, Drive, messaging, product app-api, or backend-api resources.

`packages/sdkwork-claw-chat/src/services/chatService.ts`

- Classification: local/provider boundary.
- Reason: sends chat payloads to the active OpenClaw-compatible provider endpoint with provider/runtime credentials.
- Guardrail: keep SDKWork user/session credentials out of this provider header path unless a future provider SDK explicitly defines that credential mode.

`packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`

- Classification: local/provider boundary.
- Reason: talks to the OpenClaw gateway/runtime and uses a gateway access token, not an SDKWork app-api TokenManager token.
- Guardrail: do not use this client for SDKWork appbase, Drive, messaging, product app-api, or backend-api resources.

`packages/sdkwork-claw-infrastructure/src/platform/web.ts`

- Classification: host adapter boundary.
- Reason: `fetchRemoteUrl` downloads arbitrary user-facing remote assets through the browser host adapter. It is not an SDKWork business API client.
- Guardrail: keep this API generic and do not add SDKWork auth/session headers here.

`packages/sdkwork-claw-infrastructure/src/http/httpClient.ts`

- Classification: private legacy helper, not an approved SDKWork business boundary.
- Current status: not exported from the package root or services index, and not used by migrated SDKWork auth/update paths.
- Guardrail: do not import this from business services. Remove it when no local-only utility still needs it.

## Test fixture

The following raw transport and manual header appearances are test fixture or negative-contract coverage, not production SDKWork API bypasses.

- `packages/sdkwork-claw-core/src/services/accountService.test.ts`
- `packages/sdkwork-claw-account/src/services/accountService.test.ts`
- `packages/sdkwork-claw-core/src/services/settingsService.test.ts`
- `packages/sdkwork-claw-settings/src/services/settingsService.test.ts`
- `packages/sdkwork-claw-core/src/services/taskService.test.ts`
- `packages/sdkwork-claw-infrastructure/src/updates/updateClient.test.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/browserPersistencePolicy.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderConfigPatch.test.ts`
- `packages/sdkwork-claw-web/viteWorkspaceResolver.test.ts`

## Next Product SDK Closure

Before creating `claw-studio/sdks/`, identify the owning API authority and route manifests for the product resources above. The closure path must be:

1. Define the Claw-owned app-api authority and operation ownership.
2. Generate the SDK family with `@sdkwork/sdk-generator` / `sdkgen` under the application-owned `sdks/` workspace.
3. Declare dependency SDKs instead of copying appbase, Drive, messaging, local-router, IM, RTC, or provider routes.
4. Replace `appSdkPort.ts` structural ports and injected update-client factory with generated or approved composed SDK clients.
5. Keep appbase IAM runtime as the only login/session TokenManager owner.

