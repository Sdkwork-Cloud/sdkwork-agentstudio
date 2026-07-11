import type {
  ComponentPlatformAPI,
  KnownRuntimeBundledComponentId,
  RuntimeBundledComponentId,
  RuntimeDesktopComponentCapabilityInfo,
  RuntimeDesktopComponentCatalogInfo,
  RuntimeDesktopComponentControlAction,
  RuntimeDesktopComponentControlResult,
  RuntimeDesktopComponentDocumentationRef,
  RuntimeDesktopComponentEndpointInfo,
  RuntimeDesktopComponentInfo,
  RuntimeDesktopComponentRuntimeStatus,
  RuntimeDesktopComponentStartupMode,
} from './contracts/components.ts';
import { getComponentPlatform } from './registry.ts';

export const BUNDLED_COMPONENT_IDS: KnownRuntimeBundledComponentId[] = [];

export function isBundledComponentId(value: string): value is KnownRuntimeBundledComponentId {
  return BUNDLED_COMPONENT_IDS.includes(value as KnownRuntimeBundledComponentId);
}

export class DesktopComponentLibrary {
  private readonly api: ComponentPlatformAPI;

  constructor(api: ComponentPlatformAPI = getComponentPlatform()) {
    this.api = api;
  }

  list(): Promise<RuntimeDesktopComponentCatalogInfo> {
    return this.api.listComponents();
  }

  async get(componentId: RuntimeBundledComponentId): Promise<RuntimeDesktopComponentInfo | undefined> {
    const catalog = await this.list();
    return catalog.components.find((component) => component.id === componentId);
  }

  async require(componentId: RuntimeBundledComponentId): Promise<RuntimeDesktopComponentInfo> {
    const component = await this.get(componentId);
    if (!component) {
      throw new Error(`Bundled component not found: ${componentId}`);
    }
    return component;
  }

  async getDefaultStartupComponents(): Promise<RuntimeDesktopComponentInfo[]> {
    const catalog = await this.list();
    return catalog.components.filter((component) =>
      catalog.defaultStartupComponentIds.includes(component.id),
    );
  }

  async listByStartupMode(
    startupMode: RuntimeDesktopComponentStartupMode,
  ): Promise<RuntimeDesktopComponentInfo[]> {
    const catalog = await this.list();
    return catalog.components.filter((component) => component.startupMode === startupMode);
  }

  async listByRuntimeStatus(
    runtimeStatus: RuntimeDesktopComponentRuntimeStatus,
  ): Promise<RuntimeDesktopComponentInfo[]> {
    const catalog = await this.list();
    return catalog.components.filter((component) => component.runtimeStatus === runtimeStatus);
  }

  async isDefaultStartup(componentId: RuntimeBundledComponentId): Promise<boolean> {
    const catalog = await this.list();
    return catalog.defaultStartupComponentIds.includes(componentId);
  }

  async getEndpoints(
    componentId: RuntimeBundledComponentId,
  ): Promise<RuntimeDesktopComponentEndpointInfo[]> {
    return (await this.require(componentId)).endpoints;
  }

  async getCapabilities(
    componentId: RuntimeBundledComponentId,
  ): Promise<RuntimeDesktopComponentCapabilityInfo[]> {
    return (await this.require(componentId)).capabilities;
  }

  async getDocumentation(
    componentId: RuntimeBundledComponentId,
  ): Promise<RuntimeDesktopComponentDocumentationRef[]> {
    return (await this.require(componentId)).docs;
  }

  control(
    componentId: RuntimeBundledComponentId,
    action: RuntimeDesktopComponentControlAction,
  ): Promise<RuntimeDesktopComponentControlResult> {
    return this.api.controlComponent({ componentId, action });
  }

  start(componentId: RuntimeBundledComponentId): Promise<RuntimeDesktopComponentControlResult> {
    return this.control(componentId, 'start');
  }

  stop(componentId: RuntimeBundledComponentId): Promise<RuntimeDesktopComponentControlResult> {
    return this.control(componentId, 'stop');
  }

  restart(componentId: RuntimeBundledComponentId): Promise<RuntimeDesktopComponentControlResult> {
    return this.control(componentId, 'restart');
  }
}

export function createDesktopComponentLibrary(
  api: ComponentPlatformAPI = getComponentPlatform(),
): DesktopComponentLibrary {
  return new DesktopComponentLibrary(api);
}

export const componentLibrary = createDesktopComponentLibrary();
