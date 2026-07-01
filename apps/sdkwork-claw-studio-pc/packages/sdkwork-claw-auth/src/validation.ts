import {
  assertUserCenterValidationPreflightCompatibility,
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME,
  createUserCenterValidationInteropContract,
  createUserCenterValidationPluginDefinition,
  createUserCenterValidationPreflightReport,
  createUserCenterValidationSnapshot,
  requireUserCenterProtectedToken,
  resolveUserCenterProtectedToken,
  type UserCenterProtectedTokenRequirementOptions,
  type UserCenterProtectedTokenResolutionOptions,
  type UserCenterValidationInteropContract,
  type UserCenterValidationPluginDefinition,
  type UserCenterValidationPreflightReport,
  type UserCenterValidationSnapshot,
} from './services/index.ts';
import {
  createClawAuthUserCenterConfig,
  createClawAuthUserCenterPluginDefinition,
  createClawAuthUserCenterServerValidationPluginDefinition as createStandardClawAuthUserCenterServerValidationPluginDefinition,
  type ClawAuthUserCenterServerValidationPluginDefinition,
  type CreateClawAuthUserCenterConfigOptions,
  type CreateClawAuthUserCenterPluginDefinitionOptions,
  type CreateClawAuthUserCenterServerPluginDefinitionOptions,
} from './userCenterStandard.ts';

export type ClawAuthUserCenterValidationSnapshot = UserCenterValidationSnapshot;
export type ClawAuthUserCenterValidationPluginDefinition = UserCenterValidationPluginDefinition;
export type ClawAuthUserCenterValidationInteropContract =
  UserCenterValidationInteropContract;
export type ClawAuthUserCenterValidationPreflightReport =
  UserCenterValidationPreflightReport;
export type ClawAuthProtectedTokenResolutionOptions =
  UserCenterProtectedTokenResolutionOptions;
export type ClawAuthProtectedTokenRequirementOptions =
  UserCenterProtectedTokenRequirementOptions;

export interface CreateClawAuthUserCenterValidationPreflightOptions
  extends CreateClawAuthUserCenterConfigOptions {
  peerContract: ClawAuthUserCenterValidationInteropContract;
}

export const CLAW_AUTH_USER_CENTER_VALIDATION_SOURCE_PACKAGE =
  USER_CENTER_VALIDATION_SOURCE_PACKAGE_NAME;
export const CLAW_AUTH_USER_CENTER_VALIDATION_PLUGIN_PACKAGES = Object.freeze([
  '@sdkwork/claw-auth',
]);

export function createClawAuthUserCenterValidationSnapshot(
  options: CreateClawAuthUserCenterConfigOptions = {},
): ClawAuthUserCenterValidationSnapshot {
  return createUserCenterValidationSnapshot(createClawAuthUserCenterConfig(options));
}

export function createClawAuthUserCenterValidationInteropContract(
  options: CreateClawAuthUserCenterConfigOptions = {},
): ClawAuthUserCenterValidationInteropContract {
  return createUserCenterValidationInteropContract(
    createClawAuthUserCenterValidationSnapshot(options),
  );
}

export function createClawAuthUserCenterValidationPluginDefinition(
  options: CreateClawAuthUserCenterPluginDefinitionOptions = {},
): ClawAuthUserCenterValidationPluginDefinition {
  return createUserCenterValidationPluginDefinition({
    ...options,
    packageNames:
      options.packageNames ?? [...CLAW_AUTH_USER_CENTER_VALIDATION_PLUGIN_PACKAGES],
    title: options.title ?? 'Claw Studio User Center',
    userCenterPlugin: createClawAuthUserCenterPluginDefinition(options),
  });
}

export function createClawAuthUserCenterValidationPreflightReport(
  options: CreateClawAuthUserCenterValidationPreflightOptions,
): ClawAuthUserCenterValidationPreflightReport {
  const { peerContract, ...configOptions } = options;

  return createUserCenterValidationPreflightReport({
    peerContract,
    snapshot: createClawAuthUserCenterValidationSnapshot(configOptions),
  });
}

export function assertClawAuthUserCenterValidationPreflight(
  options: CreateClawAuthUserCenterValidationPreflightOptions,
): ClawAuthUserCenterValidationPreflightReport {
  const { peerContract, ...configOptions } = options;

  return assertUserCenterValidationPreflightCompatibility({
    peerContract,
    snapshot: createClawAuthUserCenterValidationSnapshot(configOptions),
  });
}

export function resolveClawAuthProtectedToken(
  options: ClawAuthProtectedTokenResolutionOptions,
): string | null {
  return resolveUserCenterProtectedToken(options);
}

export function requireClawAuthProtectedToken(
  options: ClawAuthProtectedTokenRequirementOptions,
): string {
  return requireUserCenterProtectedToken(options);
}
