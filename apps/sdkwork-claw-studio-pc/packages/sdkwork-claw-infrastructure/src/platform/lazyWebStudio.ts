import type {
  StudioConversationRecord,
  StudioInstanceConfig,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';
import type {
  StudioCreateInstanceInput,
  StudioInstanceTaskMutationPayload,
  StudioOpenClawGatewayInvokeOptions,
  StudioOpenClawGatewayInvokeRequest,
  StudioPlatformAPI,
  StudioUpdateInstanceInput,
  StudioUpdateInstanceLlmProviderConfigInput,
} from './contracts/studio.ts';

type WebStudioPlatformModule = typeof import('./webStudio.ts');

export class LazyWebStudioPlatform implements StudioPlatformAPI {
  private platformPromise: Promise<StudioPlatformAPI> | null = null;

  private getPlatform(): Promise<StudioPlatformAPI> {
    if (!this.platformPromise) {
      this.platformPromise = import('./webStudio.ts').then((module: WebStudioPlatformModule) =>
        new module.WebStudioPlatform(),
      );
    }

    return this.platformPromise;
  }

  async listInstances() {
    return (await this.getPlatform()).listInstances();
  }

  async getInstance(id: string) {
    return (await this.getPlatform()).getInstance(id);
  }

  async getInstanceDetail(id: string) {
    return (await this.getPlatform()).getInstanceDetail(id);
  }

  async invokeOpenClawGateway(
    instanceId: string,
    request: StudioOpenClawGatewayInvokeRequest,
    options?: StudioOpenClawGatewayInvokeOptions,
  ) {
    const platform = await this.getPlatform();
    if (!platform.invokeOpenClawGateway) {
      throw new Error(
        'Studio OpenClaw gateway invoke is not available for the active platform bridge.',
      );
    }

    return platform.invokeOpenClawGateway(instanceId, request, options);
  }

  async createInstance(input: StudioCreateInstanceInput) {
    return (await this.getPlatform()).createInstance(input);
  }

  async updateInstance(id: string, input: StudioUpdateInstanceInput) {
    return (await this.getPlatform()).updateInstance(id, input);
  }

  async deleteInstance(id: string) {
    return (await this.getPlatform()).deleteInstance(id);
  }

  async startInstance(id: string) {
    return (await this.getPlatform()).startInstance(id);
  }

  async stopInstance(id: string) {
    return (await this.getPlatform()).stopInstance(id);
  }

  async restartInstance(id: string) {
    return (await this.getPlatform()).restartInstance(id);
  }

  async setInstanceStatus(id: string, status: Parameters<StudioPlatformAPI['setInstanceStatus']>[1]) {
    return (await this.getPlatform()).setInstanceStatus(id, status);
  }

  async getInstanceConfig(id: string): Promise<StudioInstanceConfig | null> {
    return (await this.getPlatform()).getInstanceConfig(id);
  }

  async updateInstanceConfig(id: string, config: StudioInstanceConfig) {
    return (await this.getPlatform()).updateInstanceConfig(id, config);
  }

  async getInstanceLogs(id: string) {
    return (await this.getPlatform()).getInstanceLogs(id);
  }

  async createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ) {
    return (await this.getPlatform()).createInstanceTask(instanceId, payload);
  }

  async updateInstanceTask(
    instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ) {
    return (await this.getPlatform()).updateInstanceTask(instanceId, taskId, payload);
  }

  async updateInstanceFileContent(
    instanceId: string,
    fileId: string,
    content: string,
  ) {
    return (await this.getPlatform()).updateInstanceFileContent(instanceId, fileId, content);
  }

  async updateInstanceLlmProviderConfig(
    instanceId: string,
    providerId: string,
    update: StudioUpdateInstanceLlmProviderConfigInput,
  ) {
    return (await this.getPlatform()).updateInstanceLlmProviderConfig(
      instanceId,
      providerId,
      update,
    );
  }

  async setInstanceChannelEnabled(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ) {
    const platform = await this.getPlatform();
    if (!platform.setInstanceChannelEnabled) {
      throw new Error('Studio channel status updates are not available for the active platform bridge.');
    }

    return platform.setInstanceChannelEnabled(instanceId, channelId, enabled);
  }

  async saveInstanceChannelConfig(
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) {
    const platform = await this.getPlatform();
    if (!platform.saveInstanceChannelConfig) {
      throw new Error('Studio channel configuration writes are not available for the active platform bridge.');
    }

    return platform.saveInstanceChannelConfig(instanceId, channelId, values);
  }

  async deleteInstanceChannelConfig(instanceId: string, channelId: string) {
    const platform = await this.getPlatform();
    if (!platform.deleteInstanceChannelConfig) {
      throw new Error('Studio channel configuration deletes are not available for the active platform bridge.');
    }

    return platform.deleteInstanceChannelConfig(instanceId, channelId);
  }

  async cloneInstanceTask(instanceId: string, taskId: string, name?: string) {
    return (await this.getPlatform()).cloneInstanceTask(instanceId, taskId, name);
  }

  async runInstanceTaskNow(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord> {
    return (await this.getPlatform()).runInstanceTaskNow(instanceId, taskId);
  }

  async listInstanceTaskExecutions(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]> {
    return (await this.getPlatform()).listInstanceTaskExecutions(instanceId, taskId);
  }

  async updateInstanceTaskStatus(
    instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ) {
    return (await this.getPlatform()).updateInstanceTaskStatus(instanceId, taskId, status);
  }

  async deleteInstanceTask(instanceId: string, taskId: string) {
    return (await this.getPlatform()).deleteInstanceTask(instanceId, taskId);
  }

  async listConversations(instanceId: string): Promise<StudioConversationRecord[]> {
    return (await this.getPlatform()).listConversations(instanceId);
  }

  async putConversation(record: StudioConversationRecord): Promise<StudioConversationRecord> {
    return (await this.getPlatform()).putConversation(record);
  }

  async deleteConversation(id: string) {
    return (await this.getPlatform()).deleteConversation(id);
  }
}
