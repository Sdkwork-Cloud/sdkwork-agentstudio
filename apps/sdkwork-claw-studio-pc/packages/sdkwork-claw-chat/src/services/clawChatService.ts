import { delay } from '@sdkwork/claw-types';
import { localizedText, resolveLocalizedText } from '@sdkwork/claw-i18n';
import { getI18n } from 'react-i18next';
import type { ChatMessageData } from '../types/index.ts';

export interface IClawChatService {
  sendMessage(providerId: string, message: string): Promise<ChatMessageData>;
  getInitialMessages(providerId: string, welcomeText: string): Promise<ChatMessageData[]>;
}

export interface ClawChatServiceOptions {
  initialDelayMs?: number;
  responseDelayMs?: number;
  now?: () => Date;
}

function formatTime(now: Date) {
  const language = getI18n()?.resolvedLanguage ?? getI18n()?.language;
  return new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
}

function resolveReplyText() {
  return resolveLocalizedText(
    localizedText(
      'Thanks for reaching out! Let me check our availability and get right back to you. Do you have any specific requirements?',
      '\u611f\u8c22\u4f60\u7684\u54a8\u8be2\uff01\u6211\u5148\u5e2e\u4f60\u786e\u8ba4\u4e00\u4e0b\u5f53\u524d\u53ef\u7528\u60c5\u51b5\uff0c\u9a6c\u4e0a\u56de\u6765\u56de\u590d\u4f60\u3002\u4f60\u8fd9\u8fb9\u6709\u5177\u4f53\u9700\u6c42\u5417\uff1f',
    ),
    getI18n()?.resolvedLanguage ?? getI18n()?.language,
  );
}

export function createClawChatService(
  options: ClawChatServiceOptions = {},
): IClawChatService {
  const initialDelayMs = options.initialDelayMs ?? 300;
  const responseDelayMs = options.responseDelayMs ?? 1500;
  const getNow = () => options.now?.() ?? new Date();

  return {
    async getInitialMessages(providerId: string, welcomeText: string) {
      await delay(initialDelayMs);
      return [
        {
          id: `${providerId}-${Date.now()}`,
          sender: 'provider',
          text: welcomeText,
          time: formatTime(getNow()),
        },
      ];
    },

    async sendMessage(providerId: string, _message: string) {
      await delay(responseDelayMs);
      return {
        id: `${providerId}-${Date.now()}`,
        sender: 'provider',
        text: resolveReplyText(),
        time: formatTime(getNow()),
      };
    },
  };
}

export const clawChatService = createClawChatService();
