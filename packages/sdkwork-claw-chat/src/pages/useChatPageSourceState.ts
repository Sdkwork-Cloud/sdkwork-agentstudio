import type { ChatPageSourceState } from './chatPageContracts';
import { useChatInstanceSourceState } from './useChatInstanceSourceState';
import { useChatModelPreferenceSourceState } from './useChatModelPreferenceSourceState';
import { useChatRuntimeSourceState } from './useChatRuntimeSourceState';

export function useChatPageSourceState(): ChatPageSourceState {
  const instanceState = useChatInstanceSourceState();
  const runtimeState = useChatRuntimeSourceState();
  const preferenceState = useChatModelPreferenceSourceState({
    activeInstanceId: instanceState.activeInstanceId,
  });

  return {
    instance: instanceState,
    runtime: runtimeState,
    modelPreference: preferenceState,
  };
}
