import type {
  ManageHostEndpointRecord,
  ManageOpenClawGatewayInvokeRequest,
  ManageOpenClawGatewayRecord,
  ManageOpenClawRuntimeRecord,
  ManagePlatformAPI,
  ManageRolloutListResult,
  ManageRolloutPreview,
  ManageRolloutRecord,
  PreviewRolloutRequest,
} from './contracts/manage.ts';
import {
  joinBasePath,
  requestJson,
  resolveWebPlatformFetch,
  type WebPlatformFetch,
} from './webHttp.ts';

export const DEFAULT_MANAGE_BASE_PATH = '/claw/manage/v1';

export class WebManagePlatform implements ManagePlatformAPI {
  private readonly basePath: string;
  private readonly fetchImpl: WebPlatformFetch;

  constructor(
    basePath: string = DEFAULT_MANAGE_BASE_PATH,
    fetchImpl?: WebPlatformFetch,
  ) {
    this.basePath = basePath;
    this.fetchImpl = resolveWebPlatformFetch(fetchImpl);
  }

  async listRollouts(): Promise<ManageRolloutListResult> {
    return requestJson<ManageRolloutListResult>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/rollouts'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'manage.listRollouts',
    );
  }

  async previewRollout(input: PreviewRolloutRequest): Promise<ManageRolloutPreview> {
    return requestJson<ManageRolloutPreview>(
      this.fetchImpl,
      joinBasePath(this.basePath, `/rollouts/${encodeURIComponent(input.rolloutId)}:preview`),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      },
      `manage.previewRollout(${input.rolloutId})`,
    );
  }

  async startRollout(rolloutId: string): Promise<ManageRolloutRecord> {
    return requestJson<ManageRolloutRecord>(
      this.fetchImpl,
      joinBasePath(this.basePath, `/rollouts/${encodeURIComponent(rolloutId)}:start`),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
        },
      },
      `manage.startRollout(${rolloutId})`,
    );
  }

  async getHostEndpoints(): Promise<ManageHostEndpointRecord[]> {
    return requestJson<ManageHostEndpointRecord[]>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/host-endpoints'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'manage.getHostEndpoints',
    );
  }

  async getOpenClawRuntime(): Promise<ManageOpenClawRuntimeRecord> {
    return requestJson<ManageOpenClawRuntimeRecord>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/openclaw/runtime'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'manage.getOpenClawRuntime',
    );
  }

  async getOpenClawGateway(): Promise<ManageOpenClawGatewayRecord> {
    return requestJson<ManageOpenClawGatewayRecord>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/openclaw/gateway'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'manage.getOpenClawGateway',
    );
  }

  async invokeOpenClawGateway(request: ManageOpenClawGatewayInvokeRequest): Promise<unknown> {
    return requestJson<unknown>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/openclaw/gateway/invoke'),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      `manage.invokeOpenClawGateway(${request.tool})`,
    );
  }
}
