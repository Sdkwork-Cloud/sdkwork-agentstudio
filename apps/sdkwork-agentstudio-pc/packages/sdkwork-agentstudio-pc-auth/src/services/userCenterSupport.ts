import { resolveBrowserStorage } from './safeBrowserStorage.ts';

export type UserCenterProviderKind =
  | 'builtin-local'
  | 'sdkwork-cloud-app-api'
  | 'external-user-center';

export type UserCenterMode = 'local-native' | 'app-api-hub' | 'external-hub';

export interface UserCenterAuthTokenHeaders {
  accessTokenHeaderName: string;
  authorizationHeaderName: string;
  authorizationScheme: string;
  refreshTokenHeaderName: string;
  sessionHeaderName: string;
}

export interface UserCenterProviderConfig {
  baseUrl?: string;
  kind: UserCenterProviderKind;
  providerKey: string;
}

export interface UserCenterRoutes {
  authBasePath: string;
  userRoutePath: string;
  vipRoutePath: string;
}

export interface UserCenterStoragePlan {
  namespace: string;
  authTokenKey: string;
  accessTokenKey: string;
  refreshTokenKey: string;
}

export interface UserCenterStorageTopology {
  databaseKey?: string;
  migrationNamespace?: string;
  storagePlan?: UserCenterStoragePlan;
  tablePrefix?: string;
}

export interface UserCenterAuthConfig {
  mode: 'local-session' | 'upstream-external-token-bridge';
  tokenHeaders: UserCenterAuthTokenHeaders;
}

export interface UserCenterBridgeConfig {
  auth: UserCenterAuthConfig;
  integration: {
    activeKind: UserCenterProviderKind;
    builtinLocal: {
      localApiBasePath: string;
    };
  };
  mode: UserCenterMode;
  namespace: string;
  provider: UserCenterProviderConfig;
  routes: UserCenterRoutes;
  standardEntities: readonly string[];
  storagePlan: UserCenterStoragePlan;
  storageTopology: UserCenterStorageTopology;
}

export interface UserCenterDeploymentVariable {
  description: string;
  key: string;
  required: boolean;
}

export interface UserCenterDeploymentEnvironmentVariable
  extends UserCenterDeploymentVariable {
  envName: string;
}

export interface UserCenterDeploymentEnvArtifact {
  audience: 'application-runtime' | 'gateway-runtime';
  fileName: string;
  headerComment: string;
  purpose: string;
  variables: readonly UserCenterDeploymentEnvironmentVariable[];
}

export interface UserCenterDeploymentProfile {
  handshake: {
    enabled: boolean;
  };
  kind: UserCenterProviderKind;
  localAuthorityVariables: readonly UserCenterDeploymentVariable[];
  providerKey: string;
  runtimeVariables: readonly UserCenterDeploymentVariable[];
  upstreamBridgeVariables: readonly UserCenterDeploymentVariable[];
}

export interface UserCenterDeploymentProfileSet {
  activeKind: UserCenterProviderKind;
  builtinLocal: UserCenterDeploymentProfile;
  externalAppApi: UserCenterDeploymentProfile;
  externalUserCenter?: UserCenterDeploymentProfile;
}

export interface UserCenterPluginDefinition {
  auth: UserCenterAuthConfig;
  capabilities: readonly string[];
  capability: 'user-center';
  deployment: UserCenterDeploymentProfileSet;
  host?: string;
  integration: UserCenterBridgeConfig['integration'];
  manifests: {
    auth?: {
      forgotPasswordRoutePath: string;
      loginRoutePath: string;
      oauthCallbackRoutePattern: string;
      qrRoutePath: string;
      registerRoutePath: string;
    };
  };
  namespace: string;
  packageNames: readonly string[];
  provider: UserCenterProviderConfig;
  routes: UserCenterRoutes;
  storagePlan: UserCenterStoragePlan;
  storageTopology: UserCenterStorageTopology;
  theme?: unknown;
  title: string;
}

export interface UserCenterServerPluginDefinition {
  capability: 'user-center-server';
  packageNames: readonly string[];
  server: {
    authority: {
      activeIntegrationKind: UserCenterProviderKind;
    };
    deployment: UserCenterDeploymentProfileSet;
  };
  title: string;
}

export interface UserCenterServerValidationPluginDefinition {
  capability: 'user-center-server-validation';
  dependency: {
    capability: 'user-center-server';
  };
  middleware: {
    handshake: {
      required: boolean;
    };
  };
  title: string;
  userCenterServerPlugin: UserCenterServerPluginDefinition;
}

export interface UserCenterValidationSnapshot {
  auth: UserCenterAuthConfig;
  mode: UserCenterMode;
  provider: UserCenterProviderConfig;
  routes: UserCenterRoutes;
}

export interface UserCenterValidationInteropContract
  extends UserCenterValidationSnapshot {
  tokenHeaders: UserCenterAuthTokenHeaders;
}

export interface UserCenterValidationPluginDefinition {
  capability: 'user-center-validation';
  dependency: {
    capability: 'user-center';
    providerKey: string;
  };
  middleware: {
    handshake: {
      required: boolean;
    };
  };
  title: string;
  userCenterPlugin: UserCenterPluginDefinition;
}

export interface UserCenterValidationPreflightReport {
  ok: boolean;
  peerContract: UserCenterValidationInteropContract;
  snapshot: UserCenterValidationSnapshot;
}

export interface UserCenterProtectedTokenResolutionOptions {
  accessToken?: string | null;
  authToken?: string | null;
  refreshToken?: string | null;
}

export interface UserCenterProtectedTokenRequirementOptions
  extends UserCenterProtectedTokenResolutionOptions {
  fieldName?: string;
}

export interface CreateUserCenterTokenStoreOptions {
  legacySessionTokenKeys?: readonly string[];
  storage?: Storage;
}

export interface UserCenterRuntimeConfigInput {
  auth?: Partial<UserCenterAuthConfig>;
  localApiBasePath?: string | null;
  mode?: string | null;
  namespace: string;
  provider?: Partial<UserCenterProviderConfig>;
  routes?: Partial<UserCenterRoutes>;
  storageTopology?: UserCenterStorageTopology;
}

export interface DefaultUserCenterConfig extends UserCenterBridgeConfig {
  storage: {
    dialect: 'sqlite';
    sqlitePath: string;
  };
}

export interface CreateDefaultUserCenterConfigInput
  extends Omit<UserCenterRuntimeConfigInput, 'localApiBasePath' | 'routes'> {
  localApiBasePath?: string | null;
  routes?: Partial<UserCenterRoutes>;
  storage: {
    dialect: 'sqlite';
    sqlitePath: string;
  };
}

export interface CreateUserCenterRuntimeClientOptions {
  fetch?: typeof fetch;
  resolveValidationInteropContract?: (
    config: DefaultUserCenterConfig,
  ) => UserCenterValidationInteropContract;
  validationInteropContract?: UserCenterValidationInteropContract;
}

export const USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH = '/api/app/v1/user-center';
export const USER_CENTER_SOURCE_PACKAGE_NAME = '@sdkwork/agentstudio-pc-auth';
export const USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME = '@sdkwork/agentstudio-pc-auth';
export const USER_CENTER_SESSION_HEADER_NAME = 'x-sdkwork-user-center-session-id';
export const USER_CENTER_STANDARD_ENTITY_NAMES = ['user', 'session', 'vip'] as const;

const DEFAULT_AUTH_TOKEN_HEADERS: UserCenterAuthTokenHeaders = Object.freeze({
  accessTokenHeaderName: 'Access-Token',
  authorizationHeaderName: 'Authorization',
  authorizationScheme: 'Bearer',
  refreshTokenHeaderName: 'Refresh-Token',
  sessionHeaderName: USER_CENTER_SESSION_HEADER_NAME,
});

const DEFAULT_ROUTES: UserCenterRoutes = Object.freeze({
  authBasePath: '/login',
  userRoutePath: '/user',
  vipRoutePath: '/vip',
});

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeBaseUrl(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/\/+$/, '');
}

function normalizeRoutePath(value: string | null | undefined, fallback: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  if (normalized.startsWith('/')) {
    return normalized.replace(/\/+$/, '') || '/';
  }

  return `/${normalized.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function slugifyIdentifier(value: string | null | undefined, fallback: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return fallback;
  }

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || fallback;
}

function normalizeRequestedMode(value: string | null | undefined): UserCenterMode {
  const normalized = normalizeOptionalString(value)?.toLowerCase();

  switch (normalized) {
    case 'builtin-local':
    case 'local-native':
      return 'local-native';
    case 'sdkwork-cloud-app-api':
    case 'app-api-hub':
      return 'app-api-hub';
    case 'external-user-center':
    case 'external-hub':
      return 'external-hub';
    default:
      return 'local-native';
  }
}

function resolveProviderKindFromMode(mode: UserCenterMode): UserCenterProviderKind {
  switch (mode) {
    case 'external-hub':
      return 'external-user-center';
    case 'local-native':
      return 'builtin-local';
    default:
      return 'sdkwork-cloud-app-api';
  }
}

function createDefaultProviderKey(kind: UserCenterProviderKind) {
  switch (kind) {
    case 'external-user-center':
      return 'agent-studio-external-user-center';
    case 'builtin-local':
      return 'agent-studio-local';
    default:
      return 'agent-studio-app-api';
  }
}

function resolveStoragePlan(namespace: string): UserCenterStoragePlan {
  const normalizedNamespace = namespace.trim();

  return Object.freeze({
    namespace: normalizedNamespace,
    authTokenKey: `${normalizedNamespace}.user-center.auth-token`,
    accessTokenKey: `${normalizedNamespace}.user-center.access-token`,
    refreshTokenKey: `${normalizedNamespace}.user-center.refresh-token`,
  });
}

function resolveProviderConfig(input: UserCenterRuntimeConfigInput, mode: UserCenterMode) {
  const kind = input.provider?.kind ?? resolveProviderKindFromMode(mode);
  const baseUrl = normalizeBaseUrl(input.provider?.baseUrl);

  return Object.freeze({
    kind,
    providerKey: slugifyIdentifier(input.provider?.providerKey, createDefaultProviderKey(kind)),
    ...(baseUrl ? { baseUrl } : {}),
  } satisfies UserCenterProviderConfig);
}

function resolveAuthConfig(
  input: UserCenterRuntimeConfigInput,
  provider: UserCenterProviderConfig,
): UserCenterAuthConfig {
  const defaultMode =
    provider.kind === 'builtin-local' ? 'local-session' : 'upstream-external-token-bridge';

  return Object.freeze({
    mode: input.auth?.mode ?? defaultMode,
    tokenHeaders: Object.freeze({
      ...DEFAULT_AUTH_TOKEN_HEADERS,
      ...(input.auth?.tokenHeaders ?? {}),
    }),
  });
}

function createRuntimeVariables(): readonly UserCenterDeploymentVariable[] {
  return Object.freeze([
    {
      description: 'Public runtime mode for the user-center integration.',
      key: 'MODE',
      required: true,
    },
    {
      description: 'Public runtime provider key for the user-center integration.',
      key: 'PROVIDER_KEY',
      required: true,
    },
    {
      description: 'Public fallback local API path for the user-center integration.',
      key: 'LOCAL_API_BASE_PATH',
      required: true,
    },
  ]);
}

function createGatewayVariables(kind: UserCenterProviderKind): readonly UserCenterDeploymentVariable[] {
  if (kind === 'builtin-local') {
    return Object.freeze([]);
  }

  const baseUrlKey =
    kind === 'external-user-center' ? 'EXTERNAL_BASE_URL' : 'APP_API_BASE_URL';

  return Object.freeze([
    {
      description: 'Private authority base URL for the user-center deployment.',
      key: baseUrlKey,
      required: true,
    },
    {
      description: 'Private secret identifier for the user-center authority bridge.',
      key: 'SECRET_ID',
      required: true,
    },
    {
      description: 'Private shared secret for the user-center authority bridge.',
      key: 'SHARED_SECRET',
      required: true,
    },
  ]);
}

function createDeploymentProfile(kind: UserCenterProviderKind, providerKey: string) {
  return Object.freeze({
    handshake: Object.freeze({
      enabled: kind !== 'builtin-local',
    }),
    kind,
    localAuthorityVariables: Object.freeze([]),
    providerKey,
    runtimeVariables: createRuntimeVariables(),
    upstreamBridgeVariables: createGatewayVariables(kind),
  } satisfies UserCenterDeploymentProfile);
}

function resolveFetchImpl(explicitFetch?: typeof fetch) {
  if (explicitFetch) {
    return explicitFetch;
  }

  if (typeof fetch === 'function') {
    return fetch;
  }

  throw new Error('A fetch implementation is required to create the user-center runtime client.');
}

function validateTokenHeaders(contract: UserCenterValidationInteropContract) {
  if (
    contract.tokenHeaders.authorizationHeaderName !==
    DEFAULT_AUTH_TOKEN_HEADERS.authorizationHeaderName
  ) {
    throw new Error(
      'validationInteropContract.tokenHeaders.authorizationHeaderName must equal Authorization.',
    );
  }
}

export function createUserCenterLocalApiRoutes() {
  return Object.freeze({
    basePath: USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
  });
}

export function createUserCenterStoragePlan(namespace: string) {
  return resolveStoragePlan(namespace);
}

export function createUserCenterBridgeConfig(
  input: UserCenterRuntimeConfigInput,
): UserCenterBridgeConfig {
  const namespace = normalizeOptionalString(input.namespace) ?? 'agent-studio';
  const mode = normalizeRequestedMode(input.mode);
  const provider = resolveProviderConfig(input, mode);
  const localApiBasePath = normalizeRoutePath(
    input.localApiBasePath,
    USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
  );
  const routes = Object.freeze({
    authBasePath: normalizeRoutePath(input.routes?.authBasePath, DEFAULT_ROUTES.authBasePath),
    userRoutePath: normalizeRoutePath(input.routes?.userRoutePath, DEFAULT_ROUTES.userRoutePath),
    vipRoutePath: normalizeRoutePath(input.routes?.vipRoutePath, DEFAULT_ROUTES.vipRoutePath),
  } satisfies UserCenterRoutes);
  const storagePlan = resolveStoragePlan(namespace);
  const auth = resolveAuthConfig(input, provider);

  return Object.freeze({
    auth,
    integration: Object.freeze({
      activeKind: provider.kind,
      builtinLocal: Object.freeze({
        localApiBasePath,
      }),
    }),
    mode,
    namespace,
    provider,
    routes,
    standardEntities: USER_CENTER_STANDARD_ENTITY_NAMES,
    storagePlan,
    storageTopology: Object.freeze({
      ...(input.storageTopology ?? {}),
      storagePlan,
    }),
  });
}

export function createUserCenterDeploymentEnvArtifact(
  artifact: UserCenterDeploymentEnvArtifact,
): UserCenterDeploymentEnvArtifact {
  return Object.freeze({
    ...artifact,
    variables: Object.freeze([...artifact.variables]),
  });
}

export function mapUserCenterDeploymentVariablesToEnvironmentVariables(
  variables: readonly UserCenterDeploymentVariable[],
  prefix: string,
) {
  return variables.map((variable) =>
    Object.freeze({
      ...variable,
      envName: `${prefix}${variable.key}`,
    }),
  );
}

export function mergeUserCenterDeploymentVariables(
  ...groups: Array<readonly UserCenterDeploymentVariable[]>
) {
  const merged = new Map<string, UserCenterDeploymentVariable>();

  for (const group of groups) {
    for (const variable of group) {
      merged.set(variable.key, variable);
    }
  }

  return Object.freeze([...merged.values()]);
}

export function selectUserCenterDeploymentVariables(
  profile: UserCenterDeploymentProfile,
  audience:
    | 'application-runtime'
    | 'external-authority-bridge'
    | 'local-authority'
    | 'upstream-bridge',
) {
  switch (audience) {
    case 'application-runtime':
      return profile.runtimeVariables;
    case 'local-authority':
      return profile.localAuthorityVariables;
    default:
      return profile.upstreamBridgeVariables;
  }
}

export function createUserCenterPluginDefinition(
  options: {
    auth?: Partial<UserCenterAuthConfig>;
    capabilities?: readonly string[];
    host?: string;
    localApiBasePath?: string | null;
    mode?: string | null;
    namespace: string;
    packageNames?: readonly string[];
    provider?: Partial<UserCenterProviderConfig>;
    routes?: Partial<UserCenterRoutes>;
    storageTopology?: UserCenterStorageTopology;
    theme?: unknown;
    title?: string;
  },
): UserCenterPluginDefinition {
  const bridgeConfig = createUserCenterBridgeConfig({
    auth: options.auth,
    localApiBasePath: options.localApiBasePath,
    mode: options.mode,
    namespace: options.namespace,
    provider: options.provider,
    routes: options.routes,
    storageTopology: options.storageTopology,
  });
  const builtinLocal = createDeploymentProfile(
    'builtin-local',
    slugifyIdentifier('agent-studio-local', 'agent-studio-local'),
  );
  const externalAppApi = createDeploymentProfile(
    'sdkwork-cloud-app-api',
    bridgeConfig.provider.kind === 'sdkwork-cloud-app-api'
      ? bridgeConfig.provider.providerKey
      : 'agent-studio-app-api',
  );
  const externalUserCenter = createDeploymentProfile(
    'external-user-center',
    bridgeConfig.provider.kind === 'external-user-center'
      ? bridgeConfig.provider.providerKey
      : 'agent-studio-external-user-center',
  );

  return Object.freeze({
    auth: bridgeConfig.auth,
    capabilities: Object.freeze([...(options.capabilities ?? ['auth'])]),
    capability: 'user-center',
    deployment: Object.freeze({
      activeKind: bridgeConfig.integration.activeKind,
      builtinLocal,
      externalAppApi,
      externalUserCenter,
    }),
    ...(options.host ? { host: options.host } : {}),
    integration: bridgeConfig.integration,
    manifests: Object.freeze({
      auth: Object.freeze({
        forgotPasswordRoutePath: options.routes?.authBasePath ?? DEFAULT_ROUTES.authBasePath,
        loginRoutePath: options.routes?.authBasePath ?? DEFAULT_ROUTES.authBasePath,
        oauthCallbackRoutePattern: '/login/oauth/callback/:provider',
        qrRoutePath: options.routes?.authBasePath ?? DEFAULT_ROUTES.authBasePath,
        registerRoutePath: '/register',
      }),
    }),
    namespace: bridgeConfig.namespace,
    packageNames: Object.freeze([...(options.packageNames ?? [])]),
    provider: bridgeConfig.provider,
    routes: bridgeConfig.routes,
    storagePlan: bridgeConfig.storagePlan,
    storageTopology: bridgeConfig.storageTopology,
    ...(typeof options.theme !== 'undefined' ? { theme: options.theme } : {}),
    title: options.title ?? 'User Center',
  });
}

export function createUserCenterServerPluginDefinition(
  options: {
    auth?: Partial<UserCenterAuthConfig>;
    description?: string;
    localApiBasePath?: string | null;
    mode?: string | null;
    namespace: string;
    packageNames?: readonly string[];
    provider?: Partial<UserCenterProviderConfig>;
    routes?: Partial<UserCenterRoutes>;
    storageTopology?: UserCenterStorageTopology;
    title?: string;
  },
): UserCenterServerPluginDefinition {
  const plugin = createUserCenterPluginDefinition({
    auth: options.auth,
    localApiBasePath: options.localApiBasePath,
    mode: options.mode,
    namespace: options.namespace,
    packageNames: options.packageNames,
    provider: options.provider,
    routes: options.routes,
    storageTopology: options.storageTopology,
    title: options.title,
  });

  return Object.freeze({
    capability: 'user-center-server',
    packageNames: plugin.packageNames,
    server: Object.freeze({
      authority: Object.freeze({
        activeIntegrationKind: plugin.deployment.activeKind,
      }),
      deployment: plugin.deployment,
    }),
    title: options.title ?? 'User Center Server',
  });
}

export function createUserCenterServerValidationPluginDefinition(
  options: {
    packageNames?: readonly string[];
    title?: string;
    userCenterServerPlugin: UserCenterServerPluginDefinition;
  },
): UserCenterServerValidationPluginDefinition {
  return Object.freeze({
    capability: 'user-center-server-validation',
    dependency: Object.freeze({
      capability: 'user-center-server',
    }),
    middleware: Object.freeze({
      handshake: Object.freeze({
        required: true,
      }),
    }),
    title: options.title ?? 'User Center Server Validation',
    userCenterServerPlugin: options.userCenterServerPlugin,
  });
}

export function createDefaultUserCenterConfig(
  input: CreateDefaultUserCenterConfigInput,
): DefaultUserCenterConfig {
  const bridgeConfig = createUserCenterBridgeConfig({
    auth: input.auth,
    localApiBasePath: input.localApiBasePath,
    mode: input.mode,
    namespace: input.namespace,
    provider: input.provider,
    routes: input.routes,
    storageTopology: input.storageTopology,
  });

  return Object.freeze({
    ...bridgeConfig,
    storage: Object.freeze({
      ...input.storage,
    }),
  });
}

function hasStorage(value: unknown): value is Storage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Storage).getItem === 'function' &&
      typeof (value as Storage).setItem === 'function' &&
      typeof (value as Storage).removeItem === 'function',
  );
}

function resolveSessionStorage(explicitStorage?: Storage) {
  if (hasStorage(explicitStorage)) {
    return explicitStorage;
  }

  return resolveBrowserStorage('sessionStorage');
}

function readStorageValue(storage: Storage | null, key: string) {
  if (!storage) {
    return undefined;
  }

  try {
    const normalized = storage.getItem(key)?.trim();
    return normalized || undefined;
  } catch {
    return undefined;
  }
}

function writeStorageValue(storage: Storage | null, key: string, value?: string | null) {
  if (!storage) {
    return;
  }

  try {
    const normalized = normalizeOptionalString(value);
    if (normalized) {
      storage.setItem(key, normalized);
      return;
    }

    storage.removeItem(key);
  } catch {
    // Browser privacy modes can expose Storage but reject operations.
  }
}

export function createUserCenterTokenStore(
  storagePlan: UserCenterStoragePlan,
  options: CreateUserCenterTokenStoreOptions = {},
) {
  const storage = resolveSessionStorage(options.storage);

  return {
    clearTokenBundle() {
      writeStorageValue(storage, storagePlan.authTokenKey, null);
      writeStorageValue(storage, storagePlan.accessTokenKey, null);
      writeStorageValue(storage, storagePlan.refreshTokenKey, null);
    },
    persistTokenBundle(bundle: UserCenterProtectedTokenResolutionOptions) {
      writeStorageValue(storage, storagePlan.authTokenKey, bundle.authToken);
      writeStorageValue(storage, storagePlan.accessTokenKey, bundle.accessToken);
      writeStorageValue(storage, storagePlan.refreshTokenKey, bundle.refreshToken);
    },
    readTokenBundle() {
      return {
        authToken: readStorageValue(storage, storagePlan.authTokenKey),
        accessToken: readStorageValue(storage, storagePlan.accessTokenKey),
        refreshToken: readStorageValue(storage, storagePlan.refreshTokenKey),
      };
    },
  };
}

export function createUserCenterSessionStore(
  storagePlan: UserCenterStoragePlan,
  options: CreateUserCenterTokenStoreOptions = {},
) {
  const tokenStore = createUserCenterTokenStore(storagePlan, options);

  return {
    clearSession: tokenStore.clearTokenBundle,
    persistSession: tokenStore.persistTokenBundle,
    readSession: tokenStore.readTokenBundle,
  };
}

export function resolveUserCenterRuntimeConfigInput<
  T extends {
    localApiBasePath?: string | null;
    mode?: string | null;
    provider?: Partial<UserCenterProviderConfig>;
  },
>(
  options: T,
  bindings: {
    env?: Record<string, unknown>;
    envPrefix: string;
    window?: Record<string, unknown>;
    windowPrefix: string;
  },
) {
  const readEnvValue = (key: string) =>
    normalizeOptionalString(
      typeof bindings.env?.[`${bindings.envPrefix}${key}`] === 'string'
        ? (bindings.env?.[`${bindings.envPrefix}${key}`] as string)
        : null,
    );
  const readWindowValue = (key: string) =>
    normalizeOptionalString(
      typeof bindings.window?.[`__${bindings.windowPrefix}${key}__`] === 'string'
        ? (bindings.window?.[`__${bindings.windowPrefix}${key}__`] as string)
        : typeof bindings.window?.[`${bindings.windowPrefix}${key}`] === 'string'
          ? (bindings.window?.[`${bindings.windowPrefix}${key}`] as string)
          : null,
    );

  const mode = normalizeRequestedMode(
    options.mode ?? readEnvValue('MODE') ?? readWindowValue('MODE'),
  );
  const providerKind = options.provider?.kind ?? resolveProviderKindFromMode(mode);
  const baseUrl =
    normalizeBaseUrl(options.provider?.baseUrl) ??
    (providerKind === 'external-user-center'
      ? normalizeBaseUrl(readWindowValue('EXTERNAL_BASE_URL') ?? readEnvValue('EXTERNAL_BASE_URL'))
      : normalizeBaseUrl(readWindowValue('APP_API_BASE_URL') ?? readEnvValue('APP_API_BASE_URL')));

  return {
    ...options,
    localApiBasePath:
      options.localApiBasePath ??
      readEnvValue('LOCAL_API_BASE_PATH') ??
      readWindowValue('LOCAL_API_BASE_PATH') ??
      USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
    mode,
    provider: {
      ...options.provider,
      ...(baseUrl ? { baseUrl } : {}),
      kind: providerKind,
      providerKey: slugifyIdentifier(
        options.provider?.providerKey ??
          readEnvValue('PROVIDER_KEY') ??
          readWindowValue('PROVIDER_KEY'),
        createDefaultProviderKey(providerKind),
      ),
    },
  };
}

export function createUserCenterRuntimeClient(
  config: DefaultUserCenterConfig,
  options: CreateUserCenterRuntimeClientOptions = {},
) {
  const fetchImpl = resolveFetchImpl(options.fetch);

  return {
    async getProfile() {
      const validationInteropContract =
        options.validationInteropContract ??
        options.resolveValidationInteropContract?.(config) ??
        createUserCenterValidationInteropContract(
          createUserCenterValidationSnapshot(config),
        );

      validateTokenHeaders(validationInteropContract);

      const response = await fetchImpl(
        `${config.integration.builtinLocal.localApiBasePath}/profile`,
        {
          headers: {
            [DEFAULT_AUTH_TOKEN_HEADERS.authorizationHeaderName]:
              `${DEFAULT_AUTH_TOKEN_HEADERS.authorizationScheme} token`,
          },
          method: 'GET',
        },
      );

      return response.json();
    },
  };
}

export function createUserCenterValidationSnapshot(
  config: Pick<DefaultUserCenterConfig, 'auth' | 'mode' | 'provider' | 'routes'>,
): UserCenterValidationSnapshot {
  return Object.freeze({
    auth: config.auth,
    mode: config.mode,
    provider: config.provider,
    routes: config.routes,
  });
}

export function createUserCenterValidationInteropContract(
  snapshot: UserCenterValidationSnapshot,
): UserCenterValidationInteropContract {
  return Object.freeze({
    ...snapshot,
    tokenHeaders: snapshot.auth.tokenHeaders,
  });
}

export function createUserCenterValidationPluginDefinition(
  options: {
    packageNames?: readonly string[];
    title?: string;
    userCenterPlugin: UserCenterPluginDefinition;
  },
): UserCenterValidationPluginDefinition {
  return Object.freeze({
    capability: 'user-center-validation',
    dependency: Object.freeze({
      capability: 'user-center',
      providerKey: options.userCenterPlugin.provider.providerKey,
    }),
    middleware: Object.freeze({
      handshake: Object.freeze({
        required: true,
      }),
    }),
    title: options.title ?? 'User Center Validation',
    userCenterPlugin: options.userCenterPlugin,
  });
}

export function createUserCenterValidationPreflightReport(input: {
  peerContract: UserCenterValidationInteropContract;
  snapshot: UserCenterValidationSnapshot;
}): UserCenterValidationPreflightReport {
  return Object.freeze({
    ok:
      input.peerContract.provider.kind === input.snapshot.provider.kind &&
      input.peerContract.provider.providerKey === input.snapshot.provider.providerKey,
    peerContract: input.peerContract,
    snapshot: input.snapshot,
  });
}

export function assertUserCenterValidationPreflightCompatibility(input: {
  peerContract: UserCenterValidationInteropContract;
  snapshot: UserCenterValidationSnapshot;
}) {
  const report = createUserCenterValidationPreflightReport(input);

  if (!report.ok) {
    throw new Error('User-center validation preflight compatibility check failed.');
  }

  return report;
}

export function resolveUserCenterProtectedToken(
  options: UserCenterProtectedTokenResolutionOptions,
) {
  return (
    normalizeOptionalString(options.accessToken) ??
    normalizeOptionalString(options.authToken) ??
    normalizeOptionalString(options.refreshToken) ??
    null
  );
}

export function requireUserCenterProtectedToken(
  options: UserCenterProtectedTokenRequirementOptions,
) {
  const token = resolveUserCenterProtectedToken(options);
  if (!token) {
    throw new Error(`${options.fieldName ?? 'protectedToken'} is required.`);
  }

  return token;
}
