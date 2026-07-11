import type {
  HostPlatformStatusRecord,
  InternalNodeSessionRecord,
  InternalPlatformAPI,
} from './contracts/internal.ts';
import {
  joinBasePath,
  requestJson,
  resolveWebPlatformFetch,
  type WebPlatformFetch,
} from './webHttp.ts';

export const DEFAULT_INTERNAL_BASE_PATH = '/claw/internal/v1';

export class WebInternalPlatform implements InternalPlatformAPI {
  private readonly basePath: string;
  private readonly fetchImpl: WebPlatformFetch;

  constructor(
    basePath: string = DEFAULT_INTERNAL_BASE_PATH,
    fetchImpl?: WebPlatformFetch,
  ) {
    this.basePath = basePath;
    this.fetchImpl = resolveWebPlatformFetch(fetchImpl);
  }

  async getHostPlatformStatus(): Promise<HostPlatformStatusRecord> {
    return requestJson<HostPlatformStatusRecord>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/host-platform'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'internal.getHostPlatformStatus',
    );
  }

  async listNodeSessions(): Promise<InternalNodeSessionRecord[]> {
    return requestJson<InternalNodeSessionRecord[]>(
      this.fetchImpl,
      joinBasePath(this.basePath, '/node-sessions'),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      'internal.listNodeSessions',
    );
  }
}
