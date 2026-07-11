export type KnownRuntimeBundledComponentId = never;

export type RuntimeBundledComponentId =
  | KnownRuntimeBundledComponentId
  | (string & {});

export type RuntimeDesktopComponentKind =
  | 'binary'
  | 'nodeApp'
  | 'serviceGroup'
  | 'embeddedLibrary';

export type RuntimeDesktopComponentStartupMode = 'autoStart' | 'manual' | 'embedded';

export type RuntimeDesktopComponentControlAction = 'start' | 'stop' | 'restart';

export type RuntimeDesktopComponentLifecycle =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed';

export type RuntimeDesktopComponentRuntimeStatus =
  | 'embedded'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'transitioning'
  | 'degraded'
  | 'partial';

export interface RuntimeDesktopComponentDocumentationRef {
  label: string;
  location: string;
}

export interface RuntimeDesktopComponentEndpointInfo {
  id: string;
  label: string;
  transport: string;
  target: string;
  description: string;
}

export interface RuntimeDesktopComponentCapabilityInfo {
  key: string;
  label: string;
  kind: string;
  description: string;
  entrypoints: string[];
}

export interface RuntimeDesktopComponentServiceBindingInfo {
  serviceId: string;
  lifecycle: RuntimeDesktopComponentLifecycle;
  pid?: number;
  lastError?: string;
}

export interface RuntimeDesktopComponentInfo {
  id: RuntimeBundledComponentId;
  displayName: string;
  kind: RuntimeDesktopComponentKind;
  startupMode: RuntimeDesktopComponentStartupMode;
  bundledVersion: string;
  activeVersion?: string;
  fallbackVersion?: string;
  repositoryUrl?: string;
  sourceCommit?: string;
  installSubdir: string;
  runtimeStatus: RuntimeDesktopComponentRuntimeStatus;
  serviceIds: string[];
  services: RuntimeDesktopComponentServiceBindingInfo[];
  endpoints: RuntimeDesktopComponentEndpointInfo[];
  capabilities: RuntimeDesktopComponentCapabilityInfo[];
  docs: RuntimeDesktopComponentDocumentationRef[];
}

export interface RuntimeDesktopComponentCatalogInfo {
  defaultStartupComponentIds: RuntimeBundledComponentId[];
  components: RuntimeDesktopComponentInfo[];
}

export interface RuntimeDesktopComponentControlRequest {
  componentId: RuntimeBundledComponentId;
  action: RuntimeDesktopComponentControlAction;
}

export interface RuntimeDesktopComponentControlResult {
  componentId: RuntimeBundledComponentId;
  action: RuntimeDesktopComponentControlAction;
  outcome: string;
  affectedServiceIds: string[];
}

export interface ComponentPlatformAPI {
  listComponents(): Promise<RuntimeDesktopComponentCatalogInfo>;
  controlComponent(
    request: RuntimeDesktopComponentControlRequest,
  ): Promise<RuntimeDesktopComponentControlResult>;
}
