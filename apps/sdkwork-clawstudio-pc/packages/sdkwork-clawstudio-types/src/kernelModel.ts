export const deploymentModes = [
  'builtIn',
  'localExternal',
  'attached',
  'remote',
] as const;

export type DeploymentMode = typeof deploymentModes[number];

export const authorityOwners = [
  'appManaged',
  'userManaged',
  'remoteManaged',
] as const;

export type AuthorityOwner = typeof authorityOwners[number];

export const controlPlaneKinds = [
  'desktopHost',
  'kernelGateway',
  'bridge',
  'remoteApi',
  'none',
] as const;

export type ControlPlaneKind = typeof controlPlaneKinds[number];

export const kernelConfigAccessModes = [
  'localFs',
  'gateway',
  'bridge',
  'remoteApi',
  'unavailable',
] as const;

export type KernelConfigAccessMode = typeof kernelConfigAccessModes[number];

export interface KernelAuthority {
  owner: AuthorityOwner;
  controlPlane: ControlPlaneKind;
  lifecycleControl: boolean;
  configControl: boolean;
  upgradeControl: boolean;
  doctorSupport: boolean;
  migrationSupport: boolean;
  observable: boolean;
  writable: boolean;
}

export interface KernelConfig {
  kernelId?: string | null;
  runtimeKind?: string | null;
  configFile: string | null;
  configRoot: string | null;
  stateRoot?: string | null;
  userRoot: string | null;
  standardStateRoot?: string | null;
  standardConfigFile?: string | null;
  format: 'json' | 'json5' | 'yaml' | 'unknown';
  access: KernelConfigAccessMode;
  provenance: string;
  writable: boolean;
  resolved: boolean;
  schemaVersion: string | null;
  isStandardUserRootLayout?: boolean;
}
