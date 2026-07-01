import {
  USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
  createUserCenterLocalApiRoutes,
} from './services/index.ts';
import {
  USER_CENTER_SOURCE_PACKAGE_NAME,
  createUserCenterBridgeConfig,
} from './services/index.ts';
import {
  createUserCenterDeploymentEnvArtifact,
  mapUserCenterDeploymentVariablesToEnvironmentVariables,
  mergeUserCenterDeploymentVariables,
  selectUserCenterDeploymentVariables,
} from './services/index.ts';
import {
  createUserCenterPluginDefinition,
} from './services/index.ts';
import {
  createUserCenterServerPluginDefinition,
} from './services/index.ts';
import {
  USER_CENTER_SESSION_HEADER_NAME,
  createUserCenterStoragePlan,
} from './services/index.ts';
import {
  USER_CENTER_STANDARD_ENTITY_NAMES,
} from './services/index.ts';
import {
  createUserCenterServerValidationPluginDefinition,
} from './services/index.ts';
import {
  CLAW_STUDIO_USER_CENTER_GATEWAY_ENV_PREFIX,
  CLAW_STUDIO_USER_CENTER_NAMESPACE,
  CLAW_STUDIO_USER_CENTER_ROUTES,
  CLAW_STUDIO_USER_CENTER_RUNTIME_ENV_PREFIX,
} from '@sdkwork/claw-core';

type UserCenterBridgeConfig = ReturnType<typeof createUserCenterBridgeConfig>;
type UserCenterBridgeConfigInput = Parameters<typeof createUserCenterBridgeConfig>[0];
type UserCenterDeploymentArtifact = ReturnType<typeof createUserCenterDeploymentEnvArtifact>;
type UserCenterDeploymentEnvironmentVariable = UserCenterDeploymentArtifact['variables'][number];
type UserCenterDeploymentProfile = ReturnType<typeof createUserCenterPluginDefinition>['deployment']['builtinLocal'];
type UserCenterDeploymentProfileSet = ReturnType<typeof createUserCenterPluginDefinition>['deployment'];
type UserCenterDeploymentVariable =
  Parameters<typeof mapUserCenterDeploymentVariablesToEnvironmentVariables>[0][number];
type UserCenterIntegrationKind = UserCenterBridgeConfig['integration']['activeKind'];
type UserCenterMode = UserCenterBridgeConfig['mode'];
type UserCenterPluginCapabilityName =
  ReturnType<typeof createUserCenterPluginDefinition>['capabilities'][number];
type UserCenterPluginDefinition = ReturnType<typeof createUserCenterPluginDefinition>;
type UserCenterPluginDefinitionOptions = Parameters<typeof createUserCenterPluginDefinition>[0];
type UserCenterProviderConfig = UserCenterBridgeConfig['provider'];
type UserCenterProviderKind = UserCenterProviderConfig['kind'];
type UserCenterRoutes = UserCenterBridgeConfig['routes'];
type UserCenterServerPluginDefinition = ReturnType<typeof createUserCenterServerPluginDefinition>;
type UserCenterServerPluginDefinitionOptions =
  Parameters<typeof createUserCenterServerPluginDefinition>[0];
type UserCenterServerValidationPluginDefinition =
  ReturnType<typeof createUserCenterServerValidationPluginDefinition>;
type UserCenterStandardEntityName = UserCenterBridgeConfig['standardEntities'][number];

export type ClawAuthUserCenterMode = UserCenterMode;
export type ClawAuthUserCenterProviderKind = UserCenterProviderKind;
export type ClawAuthUserCenterIntegrationKind = UserCenterIntegrationKind;
export type ClawAuthUserCenterStandardEntityName = UserCenterStandardEntityName;
export type ClawAuthUserCenterProviderConfig = UserCenterProviderConfig;
export type ClawAuthUserCenterRoutes = UserCenterRoutes;
export type ClawAuthUserCenterRuntimeConfig = UserCenterBridgeConfig;
export type ClawAuthUserCenterServerPluginDefinition = UserCenterServerPluginDefinition;
export type ClawAuthUserCenterServerValidationPluginDefinition =
  UserCenterServerValidationPluginDefinition;
export type ClawAuthUserCenterPluginCapability = UserCenterPluginCapabilityName;
export type ClawAuthUserCenterEnvironmentVariable = UserCenterDeploymentEnvironmentVariable;
export type ClawAuthUserCenterDeploymentArtifact = UserCenterDeploymentArtifact;

export type CreateClawAuthUserCenterConfigOptions =
  Omit<UserCenterBridgeConfigInput, 'namespace' | 'routes'> & {
    routes?: Partial<ClawAuthUserCenterRoutes>;
  };
export type CreateClawAuthUserCenterPluginDefinitionOptions =
  Omit<UserCenterPluginDefinitionOptions, 'namespace' | 'routes'> & {
    capabilities?: readonly ClawAuthUserCenterPluginCapability[];
    routes?: Partial<ClawAuthUserCenterRoutes>;
  };
export type CreateClawAuthUserCenterServerPluginDefinitionOptions =
  Omit<UserCenterServerPluginDefinitionOptions, 'namespace' | 'routes'> & {
    routes?: Partial<ClawAuthUserCenterRoutes>;
  };

export interface ClawAuthUserCenterClientDeploymentProfile {
  artifacts: readonly ClawAuthUserCenterDeploymentArtifact[];
  gatewayEnvArtifact: ClawAuthUserCenterDeploymentArtifact;
  handshakeEnabled: boolean;
  kind: UserCenterDeploymentProfile['kind'];
  providerKey: string;
  runtimeEnvArtifact: ClawAuthUserCenterDeploymentArtifact;
  standard: UserCenterDeploymentProfile;
}

export interface ClawAuthUserCenterClientDeploymentProfileSet {
  activeKind: UserCenterDeploymentProfileSet['activeKind'];
  builtinLocal: ClawAuthUserCenterClientDeploymentProfile;
  externalAppApi: ClawAuthUserCenterClientDeploymentProfile;
  externalUserCenter?: ClawAuthUserCenterClientDeploymentProfile;
}

export interface ClawAuthUserCenterPluginDefinition extends UserCenterPluginDefinition {
  bridgeConfig: ClawAuthUserCenterRuntimeConfig;
  clientDeployment: ClawAuthUserCenterClientDeploymentProfileSet;
}

export const CLAW_AUTH_USER_CENTER_SOURCE_PACKAGE = USER_CENTER_SOURCE_PACKAGE_NAME;
export const CLAW_AUTH_USER_CENTER_NAMESPACE = 'claw-studio';
export const CLAW_AUTH_USER_CENTER_SESSION_HEADER_NAME = USER_CENTER_SESSION_HEADER_NAME;
export const CLAW_AUTH_USER_CENTER_STANDARD_ENTITIES = USER_CENTER_STANDARD_ENTITY_NAMES;
export const CLAW_AUTH_USER_CENTER_PLUGIN_PACKAGES = ['@sdkwork/claw-auth'] as const;
export const CLAW_AUTH_USER_CENTER_STORAGE_PLAN = createUserCenterStoragePlan(
  CLAW_AUTH_USER_CENTER_NAMESPACE,
);
export const CLAW_AUTH_USER_CENTER_ROUTES: ClawAuthUserCenterRoutes =
  CLAW_STUDIO_USER_CENTER_ROUTES;
export const CLAW_AUTH_USER_CENTER_LOCAL_API = createUserCenterLocalApiRoutes();
export const CLAW_AUTH_USER_CENTER_RUNTIME_ENV_PREFIX =
  CLAW_STUDIO_USER_CENTER_RUNTIME_ENV_PREFIX;
export const CLAW_AUTH_USER_CENTER_GATEWAY_ENV_PREFIX =
  CLAW_STUDIO_USER_CENTER_GATEWAY_ENV_PREFIX;
export const CLAW_AUTH_USER_CENTER_RUNTIME_ENV_ARTIFACT_BASENAME = 'runtime.env.example';
export const CLAW_AUTH_USER_CENTER_GATEWAY_ENV_ARTIFACT_BASENAME = 'gateway.env.example';

function createClawAuthUserCenterBasePluginArtifacts(
  options: CreateClawAuthUserCenterPluginDefinitionOptions = {},
): {
  bridgeConfig: ClawAuthUserCenterRuntimeConfig;
  plugin: UserCenterPluginDefinition;
} {
  const bridgeConfig = createClawAuthUserCenterConfig({
    auth: options.auth,
    localApiBasePath: options.localApiBasePath,
    mode: options.mode,
    provider: options.provider,
    routes: options.routes,
    storageTopology: options.storageTopology,
  });

  const plugin = createUserCenterPluginDefinition({
    auth: options.auth,
    capabilities: options.capabilities ?? ['auth'],
    host: options.host,
    localApiBasePath: options.localApiBasePath ?? USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
    mode: options.mode,
    namespace: CLAW_AUTH_USER_CENTER_NAMESPACE,
    packageNames: options.packageNames ?? [...CLAW_AUTH_USER_CENTER_PLUGIN_PACKAGES],
    provider: options.provider,
    routes: {
      authBasePath: '',
      userRoutePath:
        options.routes?.userRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.userRoutePath,
      vipRoutePath:
        options.routes?.vipRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.vipRoutePath,
    },
    storageTopology: options.storageTopology,
    theme: options.theme,
    title: options.title ?? 'Claw Studio User Center',
  });

  return {
    bridgeConfig,
    plugin,
  };
}

function mapClawAuthUserCenterEnvironmentVariables(
  variables: readonly UserCenterDeploymentVariable[],
  prefix: string,
): ClawAuthUserCenterEnvironmentVariable[] {
  return mapUserCenterDeploymentVariablesToEnvironmentVariables(
    variables,
    prefix,
  ) as ClawAuthUserCenterEnvironmentVariable[];
}

function createClawAuthDeploymentArtifactFileName(
  kind: UserCenterDeploymentProfile['kind'],
  basename: string,
): string {
  return `claw-studio.${kind}.${basename}`;
}

function createClawAuthUserCenterClientDeploymentProfile(
  profile: UserCenterDeploymentProfile,
): ClawAuthUserCenterClientDeploymentProfile {
  const runtimeEnv = Object.freeze(mapClawAuthUserCenterEnvironmentVariables(
    selectUserCenterDeploymentVariables(profile, 'application-runtime'),
    CLAW_AUTH_USER_CENTER_RUNTIME_ENV_PREFIX,
  ));
  const gatewayEnv = Object.freeze(mapClawAuthUserCenterEnvironmentVariables(
    mergeUserCenterDeploymentVariables(
      selectUserCenterDeploymentVariables(profile, 'upstream-bridge'),
      selectUserCenterDeploymentVariables(profile, 'external-authority-bridge'),
      selectUserCenterDeploymentVariables(profile, 'local-authority'),
    ),
    CLAW_AUTH_USER_CENTER_GATEWAY_ENV_PREFIX,
  ));
  const runtimeEnvArtifact = Object.freeze(createUserCenterDeploymentEnvArtifact({
    audience: 'application-runtime',
    fileName: createClawAuthDeploymentArtifactFileName(
      profile.kind,
      CLAW_AUTH_USER_CENTER_RUNTIME_ENV_ARTIFACT_BASENAME,
    ),
    headerComment: `Claw Studio ${profile.kind} runtime env`,
    purpose: `Public runtime env artifact for the Claw Studio ${profile.kind} user-center deployment.`,
    variables: runtimeEnv,
  }));
  const gatewayEnvArtifact = Object.freeze(createUserCenterDeploymentEnvArtifact({
    audience: 'gateway-runtime',
    fileName: createClawAuthDeploymentArtifactFileName(
      profile.kind,
      CLAW_AUTH_USER_CENTER_GATEWAY_ENV_ARTIFACT_BASENAME,
    ),
    headerComment: `Claw Studio ${profile.kind} gateway env`,
    purpose: `Private gateway env artifact for the Claw Studio ${profile.kind} user-center deployment.`,
    variables: gatewayEnv,
  }));

  return Object.freeze({
    artifacts: Object.freeze([runtimeEnvArtifact, gatewayEnvArtifact]),
    gatewayEnvArtifact,
    handshakeEnabled: profile.handshake.enabled,
    kind: profile.kind,
    providerKey: profile.providerKey,
    runtimeEnvArtifact,
    standard: profile,
  });
}

function createClawAuthUserCenterClientDeploymentProfileSet(
  plugin: UserCenterPluginDefinition,
): ClawAuthUserCenterClientDeploymentProfileSet {
  return Object.freeze({
    activeKind: plugin.deployment.activeKind,
    builtinLocal: createClawAuthUserCenterClientDeploymentProfile(
      plugin.deployment.builtinLocal,
    ),
    externalAppApi: createClawAuthUserCenterClientDeploymentProfile(
      plugin.deployment.externalAppApi,
    ),
    ...(plugin.deployment.externalUserCenter
      ? {
          externalUserCenter: createClawAuthUserCenterClientDeploymentProfile(
            plugin.deployment.externalUserCenter,
          ),
        }
      : {}),
  });
}

function createClawAuthUserCenterAuthManifest(
  plugin: UserCenterPluginDefinition,
) {
  if (!plugin.manifests.auth) {
    return undefined;
  }

  return {
    ...plugin.manifests.auth,
    forgotPasswordRoutePath: '/forgot-password',
    loginRoutePath: '/login',
    oauthCallbackRoutePattern: '/login/oauth/callback/:provider',
    qrRoutePath: '/login',
    registerRoutePath: '/register',
  };
}

export function createClawAuthUserCenterConfig(
  options: CreateClawAuthUserCenterConfigOptions = {},
): ClawAuthUserCenterRuntimeConfig {
  return createUserCenterBridgeConfig({
    auth: options.auth,
    localApiBasePath: options.localApiBasePath ?? USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
    mode: options.mode,
    namespace: CLAW_AUTH_USER_CENTER_NAMESPACE,
    provider: options.provider,
    routes: {
      authBasePath:
        options.routes?.authBasePath ?? CLAW_AUTH_USER_CENTER_ROUTES.authBasePath,
      userRoutePath:
        options.routes?.userRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.userRoutePath,
      vipRoutePath:
        options.routes?.vipRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.vipRoutePath,
    },
    storageTopology: options.storageTopology,
  });
}

export function createClawAuthUserCenterPluginDefinition(
  options: CreateClawAuthUserCenterPluginDefinitionOptions = {},
): ClawAuthUserCenterPluginDefinition {
  const { bridgeConfig, plugin } = createClawAuthUserCenterBasePluginArtifacts(options);
  const authManifest = createClawAuthUserCenterAuthManifest(plugin);

  return {
    ...plugin,
    bridgeConfig,
    clientDeployment: createClawAuthUserCenterClientDeploymentProfileSet(plugin),
    integration: bridgeConfig.integration,
    manifests: {
      ...plugin.manifests,
      ...(authManifest ? { auth: authManifest } : {}),
    },
    storageTopology: bridgeConfig.storageTopology,
    storagePlan: bridgeConfig.storagePlan,
  };
}

export function createClawAuthUserCenterServerPluginDefinition(
  options: CreateClawAuthUserCenterServerPluginDefinitionOptions = {},
): ClawAuthUserCenterServerPluginDefinition {
  return createUserCenterServerPluginDefinition({
    auth: options.auth,
    description: options.description,
    localApiBasePath: options.localApiBasePath ?? USER_CENTER_DEFAULT_LOCAL_API_BASE_PATH,
    mode: options.mode,
    namespace: CLAW_AUTH_USER_CENTER_NAMESPACE,
    packageNames: options.packageNames ?? [...CLAW_AUTH_USER_CENTER_PLUGIN_PACKAGES],
    provider: options.provider,
    routes: {
      authBasePath:
        options.routes?.authBasePath ?? CLAW_AUTH_USER_CENTER_ROUTES.authBasePath,
      userRoutePath:
        options.routes?.userRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.userRoutePath,
      vipRoutePath:
        options.routes?.vipRoutePath ?? CLAW_AUTH_USER_CENTER_ROUTES.vipRoutePath,
    },
    storageTopology: options.storageTopology,
    title: options.title ?? 'Claw Studio User Center Server',
  });
}

export function createClawAuthUserCenterServerValidationPluginDefinition(
  options: CreateClawAuthUserCenterServerPluginDefinitionOptions = {},
): ClawAuthUserCenterServerValidationPluginDefinition {
  return createUserCenterServerValidationPluginDefinition({
    packageNames: options.packageNames ?? [...CLAW_AUTH_USER_CENTER_PLUGIN_PACKAGES],
    title: options.title ?? 'Claw Studio User Center Server Validation',
    userCenterServerPlugin: createClawAuthUserCenterServerPluginDefinition(options),
  });
}

export function createClawAuthUserCenterClientDeploymentProfiles(
  options: CreateClawAuthUserCenterPluginDefinitionOptions = {},
): ClawAuthUserCenterClientDeploymentProfileSet {
  const { plugin } = createClawAuthUserCenterBasePluginArtifacts(options);
  return createClawAuthUserCenterClientDeploymentProfileSet(plugin);
}

export const CLAW_AUTH_USER_CENTER_RUNTIME_CONFIG = createClawAuthUserCenterConfig();
