import type { ChatSessionControlActions } from './chatSessionControlActions.ts';

type ChatModelSelectionChannel = {
  id: string;
  defaultModelId?: string;
  models: Array<{
    id: string;
  }>;
};

export interface CreateChatModelSelectionActionsInput {
  activeInstanceId: string | null | undefined;
  activeChannelId: string;
  channels: ChatModelSelectionChannel[];
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  sessionControlActions: Pick<
    ChatSessionControlActions,
    'syncChannelModel' | 'syncExplicitModel'
  >;
}

export interface ChatModelSelectionActions {
  selectChannel: (channelId: string) => void;
  selectModel: (channelId: string, modelId: string) => void;
}

export function createChatModelSelectionActions(
  input: CreateChatModelSelectionActionsInput,
): ChatModelSelectionActions {
  return {
    selectChannel(channelId) {
      if (!input.activeInstanceId) {
        return;
      }

      const nextChannel = input.channels.find((channel) => channel.id === channelId);
      if (!nextChannel) {
        return;
      }

      input.setActiveChannel(input.activeInstanceId, channelId);

      if (nextChannel.models.length > 0) {
        const nextModelId = nextChannel.defaultModelId || nextChannel.models[0].id;
        input.setActiveModel(input.activeInstanceId, nextModelId);
        input.sessionControlActions.syncChannelModel(nextModelId);
      }
    },
    selectModel(channelId, modelId) {
      if (!input.activeInstanceId) {
        return;
      }

      if (input.activeChannelId !== channelId) {
        input.setActiveChannel(input.activeInstanceId, channelId);
      }

      input.setActiveModel(input.activeInstanceId, modelId);
      input.sessionControlActions.syncExplicitModel(modelId);
    },
  };
}
