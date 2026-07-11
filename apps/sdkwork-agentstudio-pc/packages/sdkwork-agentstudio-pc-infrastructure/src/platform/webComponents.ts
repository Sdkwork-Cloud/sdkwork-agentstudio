import type {
  ComponentPlatformAPI,
  RuntimeDesktopComponentCatalogInfo,
  RuntimeDesktopComponentControlRequest,
  RuntimeDesktopComponentControlResult,
} from './contracts/components.ts';

export class WebComponentPlatform implements ComponentPlatformAPI {
  async listComponents(): Promise<RuntimeDesktopComponentCatalogInfo> {
    return {
      defaultStartupComponentIds: [],
      components: [],
    };
  }

  async controlComponent(
    request: RuntimeDesktopComponentControlRequest,
  ): Promise<RuntimeDesktopComponentControlResult> {
    throw new Error(
      `Desktop component control is unavailable on web: ${request.componentId} (${request.action}).`,
    );
  }
}
