import {
  createChatModelSelectionActions,
  resolveChatPageModelSelection,
  resolveNewChatSessionModel,
  type ChatPageModelChannel,
} from '../services';
import type { ChatPageNewSessionModelMode } from './chatPageContracts';
import type { UseChatSessionControlStateResult } from './useChatSessionControlState';

export interface UseChatPageModelSelectionStateInput {
  activeInstanceId: string | null | undefined;
  catalogChannels: ChatPageModelChannel[];
  sessionSelectedModelId: string | null;
  activeChannelId: string;
  activeModelId: string;
  newSessionModelMode: ChatPageNewSessionModelMode;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  sessionControlActions: UseChatSessionControlStateResult['sessionControlActions'];
}

export interface UseChatPageModelSelectionStateResult {
  channels: ReturnType<typeof resolveChatPageModelSelection>['channels'];
  activeChannel: ReturnType<typeof resolveChatPageModelSelection>['activeChannel'];
  activeModel: ReturnType<typeof resolveChatPageModelSelection>['activeModel'];
  newSessionModel: string | undefined;
  handleChannelChange: (channelId: string) => void;
  handleModelChange: (channelId: string, modelId: string) => void;
}

export function useChatPageModelSelectionState({
  activeInstanceId,
  catalogChannels,
  sessionSelectedModelId,
  activeChannelId,
  activeModelId,
  newSessionModelMode,
  setActiveChannel,
  setActiveModel,
  sessionControlActions,
}: UseChatPageModelSelectionStateInput): UseChatPageModelSelectionStateResult {
  const { channels, activeChannel, activeModel } = resolveChatPageModelSelection({
    catalogChannels,
    sessionSelectedModelId,
    activeChannelId,
    activeModelId,
  });
  const modelSelectionActions = createChatModelSelectionActions({
    activeInstanceId,
    activeChannelId: activeChannel?.id ?? activeChannelId,
    channels,
    setActiveChannel,
    setActiveModel,
    sessionControlActions,
  });
  const newSessionModel = resolveNewChatSessionModel({
    newSessionModelMode,
    activeModelId: activeModel?.id,
    activeModelName: activeModel?.name,
  });
  const handleChannelChange = modelSelectionActions.selectChannel;
  const handleModelChange = modelSelectionActions.selectModel;

  return {
    channels,
    activeChannel,
    activeModel,
    newSessionModel,
    handleChannelChange,
    handleModelChange,
  };
}
