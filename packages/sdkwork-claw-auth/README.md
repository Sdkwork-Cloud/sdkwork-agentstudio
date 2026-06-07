# @sdkwork/claw-auth

Claw Studio auth center for web and desktop hosts.

This package ships a desktop-grade authentication surface with focused page orchestration, configurable login methods, reusable QR and OAuth blocks, and generated-sdk-backed remote auth flows.

## Scope

`@sdkwork/claw-auth` owns auth page composition only:

- login
- register
- forgot password
- OAuth callback
- auth runtime configuration entrypoint

It does not own raw HTTP, token persistence, or backend contract handling. Those stay in `@sdkwork/claw-core` and the generated `retired generic app SDK package` path.

## Supported Flows

Login:

- username or account + password
- phone verification code
- email verification code
- QR login
- OAuth login

Registration:

- email verification + password
- phone verification + password

Recovery:

- email verification + password reset
- phone verification + password reset

Default OAuth providers:

- `wechat`
- `douyin`
- `github`
- `google`

Additional OAuth providers can be enabled through runtime or env configuration.

## Package Structure

Pages:

- `src/pages/AuthPage.tsx`
- `src/pages/AuthOAuthCallbackPage.tsx`

Composable auth blocks:

- `src/components/auth/AccountPasswordLoginForm.tsx`
- `src/components/auth/PhoneCodeLoginForm.tsx`
- `src/components/auth/EmailCodeLoginForm.tsx`
- `src/components/auth/RegisterFlow.tsx`
- `src/components/auth/ForgotPasswordFlow.tsx`
- `src/components/auth/QrLoginPanel.tsx`
- `src/components/auth/OAuthProviderGrid.tsx`
- `src/components/auth/AuthMethodTabs.tsx`
- `src/components/auth/VerificationCodeField.tsx`

Config and shared helpers:

- `src/components/auth/authConfig.ts`
- `src/components/auth/useActionCooldown.ts`

## Configuration

Root export:

```ts
import {
  setAuthRuntimeConfig,
  getAuthRuntimeConfig,
  clearAuthRuntimeConfig,
  type AuthRuntimeConfig,
} from '@sdkwork/claw-auth';
```

Runtime config shape:

```ts
type AuthRuntimeConfig = {
  loginMethods?: Array<'password' | 'phoneCode' | 'emailCode'>;
  registerMethods?: Array<'email' | 'phone'>;
  recoveryMethods?: Array<'email' | 'phone'>;
  oauthProviders?: string[];
  qrLoginEnabled?: boolean;
  oauthLoginEnabled?: boolean;
};
```

Example:

```ts
setAuthRuntimeConfig({
  loginMethods: ['password', 'emailCode', 'phoneCode'],
  registerMethods: ['email', 'phone'],
  recoveryMethods: ['email'],
  oauthProviders: ['wechat', 'github', 'google', 'azuread'],
  qrLoginEnabled: true,
  oauthLoginEnabled: true,
});
```

Supported env overrides:

```env
VITE_AUTH_OAUTH_PROVIDERS=wechat,douyin,github,google
VITE_AUTH_LOGIN_METHODS=password,phoneCode,emailCode
VITE_AUTH_REGISTER_METHODS=email,phone
VITE_AUTH_RECOVERY_METHODS=email,phone
VITE_AUTH_QR_LOGIN_ENABLED=true
VITE_AUTH_OAUTH_LOGIN_ENABLED=true
```

Runtime config takes precedence over env config.

## Host Integration

Typical route setup:

```tsx
import { AuthPage, AuthOAuthCallbackPage } from '@sdkwork/claw-auth';

<Route path="/login" element={<AuthPage />} />
<Route path="/register" element={<AuthPage />} />
<Route path="/forgot-password" element={<AuthPage />} />
<Route path="/login/oauth/callback/:provider" element={<AuthOAuthCallbackPage />} />
```

`AuthPage` auto-detects mode from the route:

- `/login` => login
- `/register` => register
- `/forgot-password` => forgot password

## Product Standard

This package follows these desktop auth standards:

- all remote auth actions flow through `@sdkwork/claw-core`
- QR login is isolated as a reusable panel instead of page-local logic
- OAuth providers are config-driven instead of page-hardcoded
- register and forgot-password flows are independent, not modal side effects of login
- phone and email verification inputs enforce validity before sending codes
- callback pages reject unconfigured OAuth providers
- page chrome and auth business logic stay decoupled

## Extension Rules

When extending this package:

- keep remote business calls in `@sdkwork/claw-core`
- add new OAuth providers through config first, not page conditionals
- keep page files as orchestration shells
- add new auth widgets under `src/components/auth`
- prefer route-safe, host-agnostic props and helpers

## Verification

Relevant checks:

```bash
pnpm check:sdkwork-auth
pnpm lint
pnpm build
```

## SDKWork Documentation Contract

Domain: iam
Capability: auth
Package type: react-package
Status: standardizing

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- None declared in `specs/component.spec.json`.

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `node apps/scripts/validate-component-specs.mjs --apps-root apps --json`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.
