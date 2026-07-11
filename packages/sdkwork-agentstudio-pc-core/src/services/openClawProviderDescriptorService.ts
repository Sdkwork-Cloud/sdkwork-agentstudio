import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
} from '@sdkwork/local-api-proxy';

export interface OpenClawProviderAdapter {
  api: 'anthropic-messages' | 'ollama' | 'google-generative-ai' | 'openai-completions';
  auth: 'api-key';
}

export function getOpenClawProviderIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
    xai: 'XI',
    deepseek: 'DS',
    qwen: 'QW',
    zhipu: 'ZP',
    baidu: 'BD',
    'tencent-hunyuan': 'TH',
    doubao: 'DB',
    moonshot: 'KI',
    minimax: 'MM',
    stepfun: 'SF',
    'iflytek-spark': 'IF',
  };

  return iconMap[channelId.trim().toLowerCase()] || 'AR';
}

export function titleizeOpenClawProviderKey(providerKey: string) {
  return normalizeLegacyProviderId(providerKey)
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function resolveOpenClawProviderAdapter(channelId: string): OpenClawProviderAdapter {
  switch (channelId.trim().toLowerCase()) {
    case 'anthropic':
      return {
        api: 'anthropic-messages',
        auth: 'api-key',
      };
    case 'ollama':
      return {
        api: 'ollama',
        auth: 'api-key',
      };
    case 'gemini':
    case 'google':
    case 'google-generative-ai':
      return {
        api: 'google-generative-ai',
        auth: 'api-key',
      };
    default:
      return {
        api: 'openai-completions',
        auth: 'api-key',
      };
  }
}
