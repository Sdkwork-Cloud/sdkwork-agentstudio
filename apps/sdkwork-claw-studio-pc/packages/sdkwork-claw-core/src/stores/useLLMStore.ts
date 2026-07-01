import { useStore } from 'zustand';
import {
  createLLMStore,
  llmStore,
  type InstanceLLMState,
  type LLMChannel,
  type LLMConfig,
  type LLMModel,
  type LLMState,
} from './llmStore.ts';

export {
  createLLMStore,
  llmStore,
  type InstanceLLMState,
  type LLMChannel,
  type LLMConfig,
  type LLMModel,
  type LLMState,
} from './llmStore.ts';

const useBoundLLMStore = useStore.bind(null, llmStore) as {
  (): LLMState;
  <T>(selector: (state: LLMState) => T): T;
};

export const useLLMStore = Object.assign(useBoundLLMStore, {
  getState: llmStore.getState,
  setState: llmStore.setState,
  subscribe: llmStore.subscribe,
  persist: (llmStore as typeof llmStore & { persist?: unknown }).persist,
});
