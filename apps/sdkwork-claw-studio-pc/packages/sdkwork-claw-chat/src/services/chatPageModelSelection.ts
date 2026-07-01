export interface ChatPageModel {
  id: string;
  name: string;
}

export interface ChatPageModelChannel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  icon: string;
  models: ChatPageModel[];
  defaultModelId?: string;
}

export interface ResolveChatPageModelSelectionInput {
  catalogChannels: ChatPageModelChannel[];
  sessionSelectedModelId: string | null;
  activeChannelId: string;
  activeModelId: string;
}

export interface ResolveChatPageModelSelectionResult {
  channels: ChatPageModelChannel[];
  activeChannel: ChatPageModelChannel | undefined;
  activeModel: ChatPageModel | undefined;
}

function createFallbackGatewayChannel(modelId: string): ChatPageModelChannel {
  const [providerId, rawModelId] = modelId.includes('/')
    ? modelId.split('/', 2)
    : ['openclaw', modelId];
  const label = rawModelId || modelId;

  return {
    id: providerId || 'openclaw',
    name: providerId ? providerId.charAt(0).toUpperCase() + providerId.slice(1) : 'OpenClaw',
    provider: providerId || 'openclaw',
    baseUrl: '',
    apiKey: '',
    icon: 'AI',
    defaultModelId: modelId,
    models: [
      {
        id: modelId,
        name: label,
      },
    ],
  };
}

export function resolveChatPageModelSelection(
  input: ResolveChatPageModelSelectionInput,
): ResolveChatPageModelSelectionResult {
  const channels =
    input.catalogChannels.length > 0
      ? input.catalogChannels
      : input.sessionSelectedModelId
        ? [createFallbackGatewayChannel(input.sessionSelectedModelId)]
        : [];
  const preferredModelId = input.sessionSelectedModelId || input.activeModelId || '';
  const activeChannel =
    (preferredModelId
      ? channels.find((channel) =>
          channel.models.some((model) => model.id === preferredModelId),
        )
      : undefined) ||
    channels.find((channel) => channel.id === input.activeChannelId) ||
    channels[0];
  const activeModel =
    (preferredModelId
      ? activeChannel?.models.find((model) => model.id === preferredModelId) ||
        channels
          .flatMap((channel) => channel.models)
          .find((model) => model.id === preferredModelId)
      : undefined) ||
    activeChannel?.models.find((model) => model.id === input.activeModelId) ||
    activeChannel?.models[0];

  return {
    channels,
    activeChannel,
    activeModel,
  };
}
