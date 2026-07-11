import type {
  RuntimeBuiltInOpenClawStatusChangedEvent,
  RuntimeEventUnsubscribe,
  RuntimeInfo,
  RuntimeJobRecord,
  RuntimeJobUpdateEvent,
  RuntimeLanguagePreference,
  RuntimePlatformAPI,
  RuntimeProcessOutputEvent,
} from './contracts/runtime.ts';

export class WebRuntimePlatform implements RuntimePlatformAPI {
  async getRuntimeInfo(): Promise<RuntimeInfo> {
    return {
      platform: 'web',
      startup: {
        hostMode: 'web',
        distributionFamily: 'web',
        deploymentFamily: 'bareMetal',
        acceleratorProfile: null,
        hostedBrowser: false,
        manageBasePath: null,
        internalBasePath: null,
        browserBaseUrl: null,
      },
    };
  }

  async setAppLanguage(_language: RuntimeLanguagePreference): Promise<void> {}

  async submitProcessJob(_profileId: string): Promise<string> {
    throw new Error('Desktop runtime process jobs are unavailable on web.');
  }

  async getJob(_id: string): Promise<RuntimeJobRecord> {
    throw new Error('Desktop runtime jobs are unavailable on web.');
  }

  async listJobs(): Promise<RuntimeJobRecord[]> {
    throw new Error('Desktop runtime jobs are unavailable on web.');
  }

  async cancelJob(_id: string): Promise<RuntimeJobRecord> {
    throw new Error('Desktop runtime jobs are unavailable on web.');
  }

  async subscribeJobUpdates(_listener: (event: RuntimeJobUpdateEvent) => void): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }

  async subscribeProcessOutput(_listener: (event: RuntimeProcessOutputEvent) => void): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }

  async subscribeBuiltInOpenClawStatusChanged(
    _listener: (event: RuntimeBuiltInOpenClawStatusChangedEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }
}
