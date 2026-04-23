import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createClawAuthUserCenterPluginDefinition,
  createClawAuthUserCenterServerPluginDefinition,
  createClawAuthUserCenterServerValidationPluginDefinition,
} from '../packages/sdkwork-claw-auth/src/userCenterStandard.ts';

const root = path.resolve(import.meta.dirname, '..');
const bridgePath = path.join(root, 'packages', 'sdkwork-claw-auth', 'src', 'userCenterStandard.ts');
const validationPath = path.join(root, 'packages', 'sdkwork-claw-auth', 'src', 'validation.ts');
const runtimePath = path.join(root, 'packages', 'sdkwork-claw-auth', 'src', 'userCenterRuntime.ts');
const indexPath = path.join(root, 'packages', 'sdkwork-claw-auth', 'src', 'index.ts');

const bridgeSource = fs.readFileSync(bridgePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const validationSource = fs.existsSync(validationPath)
  ? fs.readFileSync(validationPath, 'utf8')
  : '';
const runtimeSource = fs.existsSync(runtimePath)
  ? fs.readFileSync(runtimePath, 'utf8')
  : '';
const rootEnvExampleSource = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const rootEnvDevelopmentSource = fs.readFileSync(path.join(root, '.env.development'), 'utf8');
const rootEnvTestSource = fs.readFileSync(path.join(root, '.env.test'), 'utf8');
const rootEnvProductionSource = fs.readFileSync(path.join(root, '.env.production'), 'utf8');

assert.match(bridgeSource, /createUserCenterServerPluginDefinition/u);
assert.match(bridgeSource, /createUserCenterServerValidationPluginDefinition/u);
assert.match(indexSource, /userCenterStandard/u);
assert.match(indexSource, /validation/u);
assert.match(indexSource, /userCenterRuntime/u);
assert.equal(fs.existsSync(validationPath), true);
assert.equal(fs.existsSync(runtimePath), true);
assert.match(bridgeSource, /createUserCenterPluginDefinition/u);
assert.match(bridgeSource, /createUserCenterBridgeConfig/u);
assert.match(validationSource, /createUserCenterValidationPluginDefinition/u);
assert.match(validationSource, /from '\.\/userCenterStandard\.ts'/u);
assert.match(runtimeSource, /createDefaultUserCenterConfig/u);
assert.match(runtimeSource, /createUserCenterRuntimeClient/u);
assert.match(runtimeSource, /from '\.\/userCenterStandard\.ts'/u);
assert.match(runtimeSource, /from '\.\/validation\.ts'/u);

const validation = await import(pathToFileURL(validationPath).href);
const runtime = await import(pathToFileURL(runtimePath).href);

function runtimeResponseDouble(payload, { headers = {}, ok = true, status = 200 } = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: {
      get(name) {
        return normalizedHeaders.get(name.toLowerCase()) ?? null;
      },
    },
    json: async () => payload,
    ok,
    status,
  };
}

const DEFAULT_AUTH_TOKEN_HEADERS = {
  accessTokenHeaderName: 'Access-Token',
  authorizationHeaderName: 'Authorization',
  authorizationScheme: 'Bearer',
  refreshTokenHeaderName: 'Refresh-Token',
  sessionHeaderName: 'x-sdkwork-user-center-session-id',
};

const localServerPlugin = createClawAuthUserCenterServerPluginDefinition();
assert.equal(localServerPlugin.capability, 'user-center-server');
assert.equal(localServerPlugin.server.authority.activeIntegrationKind, 'builtin-local');

const remoteServerPlugin = createClawAuthUserCenterServerPluginDefinition({
  mode: 'external-hub',
  provider: {
    baseUrl: 'https://identity.vendor.local/claw',
    kind: 'external-user-center',
    providerKey: 'claw-sso',
  },
});
assert.equal(remoteServerPlugin.server.authority.activeIntegrationKind, 'external-user-center');
assert.equal(remoteServerPlugin.server.deployment.externalUserCenter.providerKey, 'claw-sso');

const serverValidation = createClawAuthUserCenterServerValidationPluginDefinition({
  mode: 'app-api-hub',
  provider: {
    baseUrl: 'https://app-api.sdkwork.local/claw',
    kind: 'sdkwork-cloud-app-api',
    providerKey: 'claw-app-api',
  },
});
assert.equal(serverValidation.capability, 'user-center-server-validation');
assert.equal(serverValidation.dependency.capability, 'user-center-server');
assert.equal(serverValidation.middleware.handshake.required, true);

const localPlugin = createClawAuthUserCenterPluginDefinition();
assert.equal(localPlugin.capability, 'user-center');
assert.equal(localPlugin.bridgeConfig.namespace, 'claw-studio');
assert.deepEqual(localPlugin.capabilities, ['auth']);
assert.equal(localPlugin.integration.activeKind, 'builtin-local');
assert.equal(localPlugin.manifests.auth?.loginRoutePath, '/login');
assert.equal(localPlugin.manifests.auth?.registerRoutePath, '/register');
assert.equal(localPlugin.manifests.auth?.forgotPasswordRoutePath, '/forgot-password');
assert.equal(localPlugin.manifests.auth?.oauthCallbackRoutePattern, '/login/oauth/callback/:provider');
assert.equal(localPlugin.manifests.auth?.qrRoutePath, '/login');

const externalPlugin = createClawAuthUserCenterPluginDefinition({
  mode: 'external-hub',
  provider: {
    baseUrl: 'https://identity.vendor.local/claw',
    kind: 'external-user-center',
    providerKey: 'claw-sso',
  },
});
assert.equal(externalPlugin.bridgeConfig.mode, 'external-hub');
assert.equal(externalPlugin.bridgeConfig.integration.activeKind, 'external-user-center');
assert.equal(externalPlugin.deployment.externalUserCenter?.providerKey, 'claw-sso');
assert.equal(externalPlugin.clientDeployment.activeKind, 'external-user-center');
assert.equal(externalPlugin.clientDeployment.externalUserCenter?.providerKey, 'claw-sso');
assert.deepEqual(
  externalPlugin.clientDeployment.externalUserCenter?.artifacts.map((artifact) => artifact.fileName),
  [
    'claw-studio.external-user-center.runtime.env.example',
    'claw-studio.external-user-center.gateway.env.example',
  ],
);
assert.deepEqual(
  externalPlugin.clientDeployment.externalUserCenter?.gatewayEnvArtifact.variables
    .filter((entry) => entry.required)
    .map((entry) => entry.envName),
  [
    'CLAW_STUDIO_USER_CENTER_EXTERNAL_BASE_URL',
    'CLAW_STUDIO_USER_CENTER_SECRET_ID',
    'CLAW_STUDIO_USER_CENTER_SHARED_SECRET',
  ],
);

const pluginValidation = validation.createClawAuthUserCenterValidationPluginDefinition({
  mode: 'external-hub',
  provider: {
    baseUrl: 'https://identity.vendor.local/claw',
    kind: 'external-user-center',
    providerKey: 'claw-sso',
  },
});
assert.equal(pluginValidation.capability, 'user-center-validation');
assert.equal(pluginValidation.dependency.capability, 'user-center');
assert.equal(pluginValidation.dependency.providerKey, 'claw-sso');

const previousWindow = globalThis.window;

try {
  globalThis.window = {
    __CLAW_STUDIO_USER_CENTER_MODE__: ' sdkwork-cloud-app-api ',
    __CLAW_STUDIO_USER_CENTER_APP_API_BASE_URL__: ' https://app-api.sdkwork.local/claw/ ',
    __CLAW_STUDIO_USER_CENTER_PROVIDER_KEY__: ' Claw App API ',
    __CLAW_STUDIO_USER_CENTER_LOCAL_API_BASE_PATH__: ' /gateway/user-center ',
  };

  const appApiConfig = runtime.createClawAuthCanonicalUserCenterConfig();
  assert.equal(appApiConfig.mode, 'app-api-hub');
  assert.equal(appApiConfig.provider.kind, 'sdkwork-cloud-app-api');
  assert.equal(appApiConfig.provider.baseUrl, 'https://app-api.sdkwork.local/claw');
  assert.equal(appApiConfig.provider.providerKey, 'claw-app-api');

  globalThis.window = {
    __CLAW_STUDIO_USER_CENTER_MODE__: ' external-user-center ',
    __CLAW_STUDIO_USER_CENTER_EXTERNAL_BASE_URL__: ' https://identity.vendor.local/claw-runtime/ ',
    __CLAW_STUDIO_USER_CENTER_PROVIDER_KEY__: ' Claw Runtime SSO ',
    __CLAW_STUDIO_USER_CENTER_LOCAL_API_BASE_PATH__: ' /external/user-center ',
  };

  const externalConfig = runtime.createClawAuthCanonicalUserCenterConfig();
  assert.equal(externalConfig.mode, 'external-hub');
  assert.equal(externalConfig.provider.kind, 'external-user-center');
  assert.equal(externalConfig.provider.baseUrl, 'https://identity.vendor.local/claw-runtime');
  assert.equal(externalConfig.provider.providerKey, 'claw-runtime-sso');
  assert.equal(externalConfig.integration.activeKind, 'external-user-center');
  assert.equal(externalConfig.auth.mode, 'upstream-external-token-bridge');
  assert.equal(
    externalConfig.integration.builtinLocal.localApiBasePath,
    '/external/user-center',
  );

  globalThis.window = {
    __CLAW_STUDIO_USER_CENTER_MODE__: ' builtin-local ',
    __CLAW_STUDIO_USER_CENTER_PROVIDER_KEY__: ' claw-local-window ',
    __CLAW_STUDIO_USER_CENTER_LOCAL_API_BASE_PATH__: ' /window/user-center ',
  };

  const localConfig = runtime.createClawAuthCanonicalUserCenterConfig();
  assert.equal(localConfig.mode, 'local-native');
  assert.equal(localConfig.provider.kind, 'builtin-local');
  assert.equal(localConfig.provider.providerKey, 'claw-local-window');
  assert.equal(
    localConfig.integration.builtinLocal.localApiBasePath,
    '/window/user-center',
  );
} finally {
  globalThis.window = previousWindow;
}

let requestCount = 0;
const client = runtime.createClawAuthUserCenterRuntimeClient(
  {
    mode: 'app-api-hub',
    provider: {
      baseUrl: 'https://app-api.sdkwork.local/claw',
      kind: 'sdkwork-cloud-app-api',
      providerKey: 'claw-app-api',
    },
  },
  {
    fetch: async () => {
      requestCount += 1;
      return runtimeResponseDouble({
        code: '2000',
        data: {
          ok: true,
        },
      });
    },
    validationInteropContract: {
      ...validation.createClawAuthUserCenterValidationInteropContract({
        mode: 'app-api-hub',
        provider: {
          baseUrl: 'https://app-api.sdkwork.local/claw',
          kind: 'sdkwork-cloud-app-api',
          providerKey: 'claw-app-api',
        },
      }),
      tokenHeaders: {
        ...DEFAULT_AUTH_TOKEN_HEADERS,
        authorizationHeaderName: 'Auth-Token',
      },
    },
  },
);

await assert.rejects(() => client.getProfile(), /tokenHeaders\.authorizationHeaderName/u);
assert.equal(requestCount, 0);

for (const [label, source] of [
  ['.env.example', rootEnvExampleSource],
  ['.env.development', rootEnvDevelopmentSource],
  ['.env.test', rootEnvTestSource],
  ['.env.production', rootEnvProductionSource],
]) {
  assert.match(
    source,
    /VITE_CLAW_STUDIO_USER_CENTER_MODE=sdkwork-cloud-app-api/u,
    `${label} must pin the canonical cloud user-center runtime mode.`,
  );
  assert.match(
    source,
    /VITE_CLAW_STUDIO_USER_CENTER_PROVIDER_KEY=claw-studio-app-api/u,
    `${label} must pin the canonical cloud user-center provider key.`,
  );
  assert.match(
    source,
    /VITE_CLAW_STUDIO_USER_CENTER_LOCAL_API_BASE_PATH=\/api\/app\/v1\/user-center/u,
    `${label} must pin the canonical local fallback API base path.`,
  );
  assert.doesNotMatch(
    source,
    /VITE_CLAW_STUDIO_USER_CENTER_(?:APP_API_BASE_URL|EXTERNAL_BASE_URL|SECRET_ID|SHARED_SECRET)=/u,
    `${label} must not publish private bridge authority or secret env vars through public Vite runtime env.`,
  );
}

assert.match(
  rootEnvExampleSource,
  /CLAW_STUDIO_USER_CENTER_APP_API_BASE_URL/u,
  '.env.example must document the private gateway env name for sdkwork-cloud-app-api deployments.',
);
assert.match(
  rootEnvExampleSource,
  /CLAW_STUDIO_USER_CENTER_SECRET_ID/u,
  '.env.example must document the private gateway secret-id env name.',
);
assert.match(
  rootEnvExampleSource,
  /CLAW_STUDIO_USER_CENTER_SHARED_SECRET/u,
  '.env.example must document the private gateway shared-secret env name.',
);
assert.match(
  rootEnvExampleSource,
  /CLAW_STUDIO_USER_CENTER_EXTERNAL_BASE_URL/u,
  '.env.example must document the private gateway external authority base-url env name.',
);

console.log('claw-studio user-center standard bridge passed.');

