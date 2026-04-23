import type {
  KernelChatAgentProfile,
  KernelChatMessage,
  KernelChatRun,
  KernelChatSession,
  StudioConversationRecord,
  StudioInstanceConfig,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';
import type {
  StudioCreateKernelChatSessionInput,
  StudioCreateInstanceInput,
  StudioInstanceTaskMutationPayload,
  StudioOpenClawGatewayInvokeOptions,
  StudioOpenClawGatewayInvokeRequest,
  StudioPatchKernelChatSessionInput,
  StudioPlatformAPI,
  StudioStartKernelChatRunInput,
  StudioUpdateInstanceInput,
  StudioUpdateInstanceLlmProviderConfigInput,
} from './contracts/studio.ts';
import {
  joinBasePath,
  requestJson,
  resolveWebPlatformFetch,
  type WebPlatformFetch,
} from './webHttp.ts';

export const DEFAULT_STUDIO_API_BASE_PATH = '/claw/api/v1';

export type HostedStudioBasePathResolver = () => Promise<string | null>;

export interface WebHostedStudioPlatformOptions {
  basePath?: string | null;
  resolveBasePath?: HostedStudioBasePathResolver;
  fetchImpl?: WebPlatformFetch;
  fallback?: StudioPlatformAPI;
}

export class WebHostedStudioPlatform implements StudioPlatformAPI {
  private readonly resolveBasePath: HostedStudioBasePathResolver;
  private readonly fetchImpl: WebPlatformFetch;
  private readonly fallback?: StudioPlatformAPI;

  constructor(options: WebHostedStudioPlatformOptions = {}) {
    const normalizedBasePath = normalizeBasePath(options.basePath);

    this.resolveBasePath = options.resolveBasePath ??
      (() => Promise.resolve(normalizedBasePath ?? DEFAULT_STUDIO_API_BASE_PATH));
    this.fetchImpl = resolveWebPlatformFetch(options.fetchImpl);
    this.fallback = options.fallback;
  }

  async listInstances(): Promise<StudioInstanceRecord[]> {
    return this.withHostedOrFallback(
      'listInstances',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord[]>(
          basePath,
          '/studio/instances',
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          'studio.listInstances',
        ),
      () => this.requireFallback('listInstances').listInstances(),
    );
  }

  async getInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.withHostedOrFallback(
      'getInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getInstance(${id})`,
        ),
      () => this.requireFallback('getInstance').getInstance(id),
    );
  }

  async getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null> {
    return this.withHostedOrFallback(
      'getInstanceDetail',
      (basePath) =>
        this.requestHostedJson<StudioInstanceDetailRecord | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}/detail`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getInstanceDetail(${id})`,
        ),
      () => this.requireFallback('getInstanceDetail').getInstanceDetail(id),
    );
  }

  async listKernelChatAgentProfiles(instanceId: string): Promise<KernelChatAgentProfile[]> {
    return this.withHostedOrFallback(
      'listKernelChatAgentProfiles',
      (basePath) =>
        this.requestHostedJson<KernelChatAgentProfile[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/agent-profiles`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.listKernelChatAgentProfiles(${instanceId})`,
        ),
      () => {
        const fallbackList =
          this.requireFallback('listKernelChatAgentProfiles').listKernelChatAgentProfiles;
        if (!fallbackList) {
          throw createHostedStudioUnavailableError('listKernelChatAgentProfiles');
        }
        return fallbackList.call(this.fallback, instanceId);
      },
    );
  }

  async listKernelChatSessions(instanceId: string): Promise<KernelChatSession[]> {
    return this.withHostedOrFallback(
      'listKernelChatSessions',
      (basePath) =>
        this.requestHostedJson<KernelChatSession[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.listKernelChatSessions(${instanceId})`,
        ),
      () => {
        const fallbackList =
          this.requireFallback('listKernelChatSessions').listKernelChatSessions;
        if (!fallbackList) {
          throw createHostedStudioUnavailableError('listKernelChatSessions');
        }
        return fallbackList.call(this.fallback, instanceId);
      },
    );
  }

  async getKernelChatSession(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatSession | null> {
    return this.withHostedOrFallback(
      'getKernelChatSession',
      (basePath) =>
        this.requestHostedJson<KernelChatSession | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getKernelChatSession(${instanceId}, ${sessionId})`,
        ),
      () => {
        const fallbackGet =
          this.requireFallback('getKernelChatSession').getKernelChatSession;
        if (!fallbackGet) {
          throw createHostedStudioUnavailableError('getKernelChatSession');
        }
        return fallbackGet.call(this.fallback, instanceId, sessionId);
      },
    );
  }

  async createKernelChatSession(
    input: StudioCreateKernelChatSessionInput,
  ): Promise<KernelChatSession> {
    return this.withHostedOrFallback(
      'createKernelChatSession',
      (basePath) =>
        this.requestHostedJson<KernelChatSession>(
          basePath,
          `/studio/instances/${encodeURIComponent(input.instanceId)}/kernel-chat/sessions`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(input),
          },
          `studio.createKernelChatSession(${input.instanceId})`,
        ),
      () => {
        const fallbackCreate =
          this.requireFallback('createKernelChatSession').createKernelChatSession;
        if (!fallbackCreate) {
          throw createHostedStudioUnavailableError('createKernelChatSession');
        }
        return fallbackCreate.call(this.fallback, input);
      },
    );
  }

  async listKernelChatRuns(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatRun[]> {
    return this.withHostedOrFallback(
      'listKernelChatRuns',
      (basePath) =>
        this.requestHostedJson<KernelChatRun[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}/runs`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.listKernelChatRuns(${instanceId}, ${sessionId})`,
        ),
      () => {
        const fallbackList = this.requireFallback('listKernelChatRuns').listKernelChatRuns;
        if (!fallbackList) {
          throw createHostedStudioUnavailableError('listKernelChatRuns');
        }
        return fallbackList.call(this.fallback, instanceId, sessionId);
      },
    );
  }

  async getKernelChatRun(
    instanceId: string,
    sessionId: string,
    runId: string,
  ): Promise<KernelChatRun | null> {
    return this.withHostedOrFallback(
      'getKernelChatRun',
      (basePath) =>
        this.requestHostedJson<KernelChatRun | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getKernelChatRun(${instanceId}, ${sessionId}, ${runId})`,
        ),
      () => {
        const fallbackGet = this.requireFallback('getKernelChatRun').getKernelChatRun;
        if (!fallbackGet) {
          throw createHostedStudioUnavailableError('getKernelChatRun');
        }
        return fallbackGet.call(this.fallback, instanceId, sessionId, runId);
      },
    );
  }

  async patchKernelChatSession(
    input: StudioPatchKernelChatSessionInput,
  ): Promise<KernelChatSession> {
    return this.withHostedOrFallback(
      'patchKernelChatSession',
      (basePath) =>
        this.requestHostedJson<KernelChatSession>(
          basePath,
          `/studio/instances/${encodeURIComponent(input.instanceId)}/kernel-chat/sessions/${encodeURIComponent(input.sessionId)}`,
          {
            method: 'PATCH',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(input),
          },
          `studio.patchKernelChatSession(${input.instanceId}, ${input.sessionId})`,
        ),
      () => {
        const fallbackPatch =
          this.requireFallback('patchKernelChatSession').patchKernelChatSession;
        if (!fallbackPatch) {
          throw createHostedStudioUnavailableError('patchKernelChatSession');
        }
        return fallbackPatch.call(this.fallback, input);
      },
    );
  }

  async deleteKernelChatSession(instanceId: string, sessionId: string): Promise<void> {
    await this.withHostedOrFallback(
      'deleteKernelChatSession',
      (basePath) =>
        this.requestHostedJson<null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: 'DELETE',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.deleteKernelChatSession(${instanceId}, ${sessionId})`,
        ),
      () => {
        const fallbackDelete =
          this.requireFallback('deleteKernelChatSession').deleteKernelChatSession;
        if (!fallbackDelete) {
          throw createHostedStudioUnavailableError('deleteKernelChatSession');
        }
        return fallbackDelete.call(this.fallback, instanceId, sessionId);
      },
    );
  }

  async startKernelChatRun(
    input: StudioStartKernelChatRunInput,
  ): Promise<KernelChatRun> {
    return this.withHostedOrFallback(
      'startKernelChatRun',
      (basePath) =>
        this.requestHostedJson<KernelChatRun>(
          basePath,
          `/studio/instances/${encodeURIComponent(input.instanceId)}/kernel-chat/sessions/${encodeURIComponent(input.sessionId)}:run`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(input),
          },
          `studio.startKernelChatRun(${input.instanceId}, ${input.sessionId})`,
        ),
      () => {
        const fallbackStart =
          this.requireFallback('startKernelChatRun').startKernelChatRun;
        if (!fallbackStart) {
          throw createHostedStudioUnavailableError('startKernelChatRun');
        }
        return fallbackStart.call(this.fallback, input);
      },
    );
  }

  async abortKernelChatRun(
    instanceId: string,
    sessionId: string,
    runId?: string | null,
  ): Promise<boolean> {
    return this.withHostedOrFallback(
      'abortKernelChatRun',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}:abort`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ runId: runId ?? null }),
          },
          `studio.abortKernelChatRun(${instanceId}, ${sessionId})`,
        ),
      () => {
        const fallbackAbort =
          this.requireFallback('abortKernelChatRun').abortKernelChatRun;
        if (!fallbackAbort) {
          throw createHostedStudioUnavailableError('abortKernelChatRun');
        }
        return fallbackAbort.call(this.fallback, instanceId, sessionId, runId);
      },
    );
  }

  async loadKernelChatMessages(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatMessage[]> {
    return this.withHostedOrFallback(
      'loadKernelChatMessages',
      (basePath) =>
        this.requestHostedJson<KernelChatMessage[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/kernel-chat/sessions/${encodeURIComponent(sessionId)}/messages`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.loadKernelChatMessages(${instanceId}, ${sessionId})`,
        ),
      () => {
        const fallbackLoad =
          this.requireFallback('loadKernelChatMessages').loadKernelChatMessages;
        if (!fallbackLoad) {
          throw createHostedStudioUnavailableError('loadKernelChatMessages');
        }
        return fallbackLoad.call(this.fallback, instanceId, sessionId);
      },
    );
  }

  async invokeOpenClawGateway(
    instanceId: string,
    request: StudioOpenClawGatewayInvokeRequest,
    options?: StudioOpenClawGatewayInvokeOptions,
  ): Promise<unknown> {
    return this.withHostedOrFallback(
      'invokeOpenClawGateway',
      (basePath) =>
        this.requestHostedJson<unknown>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/gateway/invoke`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              request,
              options,
            }),
          },
          `studio.invokeOpenClawGateway(${instanceId})`,
        ),
      () => {
        const fallbackInvoke = this.requireFallback('invokeOpenClawGateway').invokeOpenClawGateway;
        if (!fallbackInvoke) {
          throw createHostedStudioUnavailableError('invokeOpenClawGateway');
        }
        return fallbackInvoke.call(this.fallback, instanceId, request, options);
      },
    );
  }

  async createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord> {
    return this.withHostedOrFallback(
      'createInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord>(
          basePath,
          '/studio/instances',
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(input),
          },
          'studio.createInstance',
        ),
      () => this.requireFallback('createInstance').createInstance(input),
    );
  }

  async updateInstance(
    id: string,
    input: StudioUpdateInstanceInput,
  ): Promise<StudioInstanceRecord> {
    return this.withHostedOrFallback(
      'updateInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(input),
          },
          `studio.updateInstance(${id})`,
        ),
      () => this.requireFallback('updateInstance').updateInstance(id, input),
    );
  }

  async deleteInstance(id: string): Promise<boolean> {
    return this.withHostedOrFallback(
      'deleteInstance',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.deleteInstance(${id})`,
        ),
      () => this.requireFallback('deleteInstance').deleteInstance(id),
    );
  }

  async startInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.withHostedOrFallback(
      'startInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}:start`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.startInstance(${id})`,
        ),
      () => this.requireFallback('startInstance').startInstance(id),
    );
  }

  async stopInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.withHostedOrFallback(
      'stopInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}:stop`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.stopInstance(${id})`,
        ),
      () => this.requireFallback('stopInstance').stopInstance(id),
    );
  }

  async restartInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.withHostedOrFallback(
      'restartInstance',
      (basePath) =>
        this.requestHostedJson<StudioInstanceRecord | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}:restart`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.restartInstance(${id})`,
        ),
      () => this.requireFallback('restartInstance').restartInstance(id),
    );
  }

  async setInstanceStatus(
    id: string,
    status: StudioInstanceRecord['status'],
  ): Promise<StudioInstanceRecord | null> {
    if (status === 'online') {
      return this.startInstance(id);
    }

    if (status === 'offline') {
      return this.stopInstance(id);
    }

    return this.requireFallback('setInstanceStatus').setInstanceStatus(id, status);
  }

  async getInstanceConfig(id: string): Promise<StudioInstanceConfig | null> {
    return this.withHostedOrFallback(
      'getInstanceConfig',
      (basePath) =>
        this.requestHostedJson<StudioInstanceConfig | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}/config`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getInstanceConfig(${id})`,
        ),
      () => this.requireFallback('getInstanceConfig').getInstanceConfig(id),
    );
  }

  async updateInstanceConfig(
    id: string,
    config: StudioInstanceConfig,
  ): Promise<StudioInstanceConfig | null> {
    return this.withHostedOrFallback(
      'updateInstanceConfig',
      (basePath) =>
        this.requestHostedJson<StudioInstanceConfig | null>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}/config`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(config),
          },
          `studio.updateInstanceConfig(${id})`,
        ),
      () => this.requireFallback('updateInstanceConfig').updateInstanceConfig(id, config),
    );
  }

  async getInstanceLogs(id: string): Promise<string> {
    return this.withHostedOrFallback(
      'getInstanceLogs',
      (basePath) =>
        this.requestHostedJson<string>(
          basePath,
          `/studio/instances/${encodeURIComponent(id)}/logs`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.getInstanceLogs(${id})`,
        ),
      () => this.requireFallback('getInstanceLogs').getInstanceLogs(id),
    );
  }

  async createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    await this.withHostedOrFallback(
      'createInstanceTask',
      (basePath) =>
        this.requestHostedJson<null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
          `studio.createInstanceTask(${instanceId})`,
        ),
      () => this.requireFallback('createInstanceTask').createInstanceTask(instanceId, payload),
    );
  }

  async updateInstanceTask(
    instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    await this.withHostedOrFallback(
      'updateInstanceTask',
      (basePath) =>
        this.requestHostedJson<null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
          `studio.updateInstanceTask(${instanceId}, ${taskId})`,
        ),
      () =>
        this.requireFallback('updateInstanceTask').updateInstanceTask(
          instanceId,
          taskId,
          payload,
        ),
    );
  }

  async updateInstanceFileContent(
    instanceId: string,
    fileId: string,
  content: string,
  ): Promise<boolean> {
    return this.withHostedOrFallback(
      'updateInstanceFileContent',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/files/${encodeURIComponent(fileId)}`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ content }),
          },
          `studio.updateInstanceFileContent(${instanceId}, ${fileId})`,
        ),
      () =>
        this.requireFallback('updateInstanceFileContent').updateInstanceFileContent(
          instanceId,
          fileId,
          content,
        ),
    );
  }

  async updateInstanceLlmProviderConfig(
    instanceId: string,
    providerId: string,
    update: StudioUpdateInstanceLlmProviderConfigInput,
  ): Promise<boolean> {
    return this.withHostedOrFallback(
      'updateInstanceLlmProviderConfig',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/llm-providers/${encodeURIComponent(providerId)}`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(update),
          },
          `studio.updateInstanceLlmProviderConfig(${instanceId}, ${providerId})`,
        ),
      () =>
        this.requireFallback('updateInstanceLlmProviderConfig').updateInstanceLlmProviderConfig(
          instanceId,
          providerId,
          update,
        ),
    );
  }

  async cloneInstanceTask(instanceId: string, taskId: string, name?: string): Promise<void> {
    await this.withHostedOrFallback(
      'cloneInstanceTask',
      (basePath) =>
        this.requestHostedJson<null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}:clone`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(name ? { name } : {}),
          },
          `studio.cloneInstanceTask(${instanceId}, ${taskId})`,
        ),
      () => this.requireFallback('cloneInstanceTask').cloneInstanceTask(instanceId, taskId, name),
    );
  }

  async runInstanceTaskNow(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord> {
    return this.withHostedOrFallback(
      'runInstanceTaskNow',
      (basePath) =>
        this.requestHostedJson<StudioWorkbenchTaskExecutionRecord>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}:run`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.runInstanceTaskNow(${instanceId}, ${taskId})`,
        ),
      () => this.requireFallback('runInstanceTaskNow').runInstanceTaskNow(instanceId, taskId),
    );
  }

  async listInstanceTaskExecutions(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]> {
    return this.withHostedOrFallback(
      'listInstanceTaskExecutions',
      (basePath) =>
        this.requestHostedJson<StudioWorkbenchTaskExecutionRecord[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}/executions`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.listInstanceTaskExecutions(${instanceId}, ${taskId})`,
        ),
      () =>
        this.requireFallback('listInstanceTaskExecutions').listInstanceTaskExecutions(
          instanceId,
          taskId,
        ),
    );
  }

  async updateInstanceTaskStatus(
    instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ): Promise<void> {
    await this.withHostedOrFallback(
      'updateInstanceTaskStatus',
      (basePath) =>
        this.requestHostedJson<null>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}:status`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ status }),
          },
          `studio.updateInstanceTaskStatus(${instanceId}, ${taskId})`,
        ),
      () =>
        this.requireFallback('updateInstanceTaskStatus').updateInstanceTaskStatus(
          instanceId,
          taskId,
          status,
        ),
    );
  }

  async deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean> {
    return this.withHostedOrFallback(
      'deleteInstanceTask',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}`,
          {
            method: 'DELETE',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.deleteInstanceTask(${instanceId}, ${taskId})`,
        ),
      () => this.requireFallback('deleteInstanceTask').deleteInstanceTask(instanceId, taskId),
    );
  }

  async listConversations(instanceId: string): Promise<StudioConversationRecord[]> {
    return this.withHostedOrFallback(
      'listConversations',
      (basePath) =>
        this.requestHostedJson<StudioConversationRecord[]>(
          basePath,
          `/studio/instances/${encodeURIComponent(instanceId)}/conversations`,
          {
            method: 'GET',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.listConversations(${instanceId})`,
        ),
      () => this.requireFallback('listConversations').listConversations(instanceId),
    );
  }

  async putConversation(record: StudioConversationRecord): Promise<StudioConversationRecord> {
    return this.withHostedOrFallback(
      'putConversation',
      (basePath) =>
        this.requestHostedJson<StudioConversationRecord>(
          basePath,
          `/studio/conversations/${encodeURIComponent(record.id)}`,
          {
            method: 'PUT',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify(record),
          },
          `studio.putConversation(${record.id})`,
        ),
      () => this.requireFallback('putConversation').putConversation(record),
    );
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.withHostedOrFallback(
      'deleteConversation',
      (basePath) =>
        this.requestHostedJson<boolean>(
          basePath,
          `/studio/conversations/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: {
              accept: 'application/json',
            },
          },
          `studio.deleteConversation(${id})`,
        ),
      () => this.requireFallback('deleteConversation').deleteConversation(id),
    );
  }

  private async withHostedOrFallback<T>(
    operation: string,
    hostedLoader: (basePath: string) => Promise<T>,
    fallbackLoader: (() => Promise<T>) | null = null,
  ): Promise<T> {
    const basePath = normalizeBasePath(await this.resolveBasePath());

    if (basePath) {
      return hostedLoader(basePath);
    }

    if (fallbackLoader) {
      return fallbackLoader();
    }

    throw createHostedStudioUnavailableError(operation);
  }

  private requireFallback(operation: string): StudioPlatformAPI {
    if (this.fallback) {
      return this.fallback;
    }

    throw createHostedStudioUnavailableError(operation);
  }

  private async requestHostedJson<T>(
    basePath: string,
    path: string,
    init: RequestInit,
    context: string,
  ): Promise<T> {
    return requestJson<T>(
      this.fetchImpl,
      joinBasePath(basePath, path),
      init,
      context,
    );
  }
}

function createHostedStudioUnavailableError(operation: string) {
  return new Error(
    `Hosted studio operation ${operation} is not available through the canonical /claw/api/v1 bridge.`,
  );
}

function normalizeBasePath(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
