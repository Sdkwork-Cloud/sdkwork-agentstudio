import { useLLMStore } from '@sdkwork/agentstudio-pc-core';
import type { ChatPageModelPreferenceSourceState } from './chatPageContracts';

interface UseChatModelPreferenceSourceStateInput {
  activeInstanceId: string | null;
}

export function useChatModelPreferenceSourceState({
  activeInstanceId,
}: UseChatModelPreferenceSourceStateInput): ChatPageModelPreferenceSourceState {
  const setActiveChannel = useLLMStore((state) => state.setActiveChannel);
  const setActiveModel = useLLMStore((state) => state.setActiveModel);
  const getInstanceConfig = useLLMStore((state) => state.getInstanceConfig);
  const instanceConfig = activeInstanceId ? getInstanceConfig(activeInstanceId) : null;

  return {
    setActiveChannel,
    setActiveModel,
    activeChannelId: instanceConfig?.activeChannelId || '',
    activeModelId: instanceConfig?.activeModelId || '',
  };
}
