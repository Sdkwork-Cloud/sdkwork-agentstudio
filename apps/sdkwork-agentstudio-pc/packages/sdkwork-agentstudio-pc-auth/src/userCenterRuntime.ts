import {
  createDefaultUserCenterConfig,
} from './services/index.ts';
import {
  createUserCenterRuntimeClient,
} from './services/index.ts';
import {
  createUserCenterSessionStore,
  createUserCenterTokenStore,
} from './services/index.ts';
import {
  resolveUserCenterRuntimeConfigInput,
} from './services/index.ts';
import {
  CLAW_AUTH_USER_CENTER_GATEWAY_ENV_PREFIX,
  CLAW_AUTH_USER_CENTER_RUNTIME_ENV_PREFIX,
  createClawAuthUserCenterConfig,
  type CreateClawAuthUserCenterConfigOptions,
} from './userCenterStandard.ts';
import {
  createClawAuthUserCenterValidationInteropContract,
} from './validation.ts';

type UserCenterRuntimeClient = ReturnType<typeof createUserCenterRuntimeClient>;
type UserCenterRuntimeClientOptions = Parameters<typeof createUserCenterRuntimeClient>[1];
type UserCenterRuntimeConfig = ReturnType<typeof createDefaultUserCenterConfig>;

export {
  createUserCenterRuntimeClient,
  createUserCenterSessionStore,
  createUserCenterTokenStore,
};

export type CreateClawAuthCanonicalUserCenterConfigOptions =
  CreateClawAuthUserCenterConfigOptions;
export type CreateClawAuthUserCenterRuntimeClientOptions =
  UserCenterRuntimeClientOptions;
export type ClawAuthCanonicalUserCenterRuntimeConfig = UserCenterRuntimeConfig;
export type ClawAuthUserCenterRuntimeClient = UserCenterRuntimeClient;

export const CLAW_AUTH_CANONICAL_USER_CENTER_SQLITE_PATH =
  'app://agent-studio/user-center.db';
export const CLAW_AUTH_CANONICAL_USER_CENTER_DATABASE_KEY =
  'agent-studio-user-center';
export const CLAW_AUTH_CANONICAL_USER_CENTER_MIGRATION_NAMESPACE =
  'agent-studio.user-center';
export const CLAW_AUTH_CANONICAL_USER_CENTER_TABLE_PREFIX = 'claw_uc_';

function resolveClawAuthRuntimeWindow():
  | Record<string, unknown>
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as unknown as Record<string, unknown>;
}

function resolveClawAuthRuntimeEnv():
  | Record<string, unknown>
  | undefined {
  return (
    (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
    ?? undefined
  );
}

function resolveClawAuthRuntimeConfigOptions(
  options: CreateClawAuthCanonicalUserCenterConfigOptions,
): CreateClawAuthCanonicalUserCenterConfigOptions {
  return resolveUserCenterRuntimeConfigInput(options, {
    env: resolveClawAuthRuntimeEnv(),
    envPrefix: CLAW_AUTH_USER_CENTER_RUNTIME_ENV_PREFIX,
    window: resolveClawAuthRuntimeWindow(),
    windowPrefix: CLAW_AUTH_USER_CENTER_GATEWAY_ENV_PREFIX,
  });
}

function createClawAuthCanonicalStorageTopology(
  runtimeConfig: Pick<UserCenterRuntimeConfig, 'storageTopology'>,
) {
  return {
    ...runtimeConfig.storageTopology,
    databaseKey: CLAW_AUTH_CANONICAL_USER_CENTER_DATABASE_KEY,
    migrationNamespace: CLAW_AUTH_CANONICAL_USER_CENTER_MIGRATION_NAMESPACE,
    tablePrefix: CLAW_AUTH_CANONICAL_USER_CENTER_TABLE_PREFIX,
  };
}

function createDefaultClawAuthValidationInteropContract(
  runtimeConfig: UserCenterRuntimeConfig,
) {
  return createClawAuthUserCenterValidationInteropContract({
    auth: runtimeConfig.auth,
    localApiBasePath: runtimeConfig.integration.builtinLocal.localApiBasePath,
    mode: runtimeConfig.mode,
    provider: runtimeConfig.provider,
    routes: runtimeConfig.routes,
    storageTopology: runtimeConfig.storageTopology,
  });
}

export function createClawAuthCanonicalUserCenterConfig(
  options: CreateClawAuthCanonicalUserCenterConfigOptions = {},
): ClawAuthCanonicalUserCenterRuntimeConfig {
  const resolvedOptions = resolveClawAuthRuntimeConfigOptions(options);
  const bridgeConfig = createClawAuthUserCenterConfig(resolvedOptions);

  return createDefaultUserCenterConfig({
    auth: bridgeConfig.auth,
    localApiBasePath: bridgeConfig.integration.builtinLocal.localApiBasePath,
    mode: bridgeConfig.mode,
    namespace: bridgeConfig.namespace,
    provider: bridgeConfig.provider,
    routes: bridgeConfig.routes,
    storage: {
      dialect: 'sqlite',
      sqlitePath: CLAW_AUTH_CANONICAL_USER_CENTER_SQLITE_PATH,
    },
    storageTopology: createClawAuthCanonicalStorageTopology(bridgeConfig),
  });
}

export function createClawAuthUserCenterRuntimeClient(
  configOptions: CreateClawAuthCanonicalUserCenterConfigOptions = {},
  options: CreateClawAuthUserCenterRuntimeClientOptions = {},
): ClawAuthUserCenterRuntimeClient {
  const runtimeConfig = createClawAuthCanonicalUserCenterConfig(configOptions);

  return createUserCenterRuntimeClient(runtimeConfig, {
    ...options,
    ...(options.validationInteropContract || options.resolveValidationInteropContract
      ? {}
      : {
          validationInteropContract:
            createDefaultClawAuthValidationInteropContract(runtimeConfig),
        }),
  });
}
