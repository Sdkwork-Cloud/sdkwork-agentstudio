import type {
  KernelChatAttachment,
  KernelChatMessage,
} from '@sdkwork/clawstudio-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';
import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';

export interface KernelChatNoticePresentation {
  code: string;
  text: string;
  level: 'info' | 'warning' | 'error';
}

export interface KernelChatMessagePartsPresentation {
  content: string;
  reasoning: string | null;
  attachments: KernelChatAttachment[];
  toolCards: OpenClawToolCard[];
  notices: KernelChatNoticePresentation[];
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = normalizeChatMessageTextEncoding(value.trim());
  return normalized || null;
}

function normalizeNoticeLevel(value: string | null | undefined): KernelChatNoticePresentation['level'] {
  switch (normalizeOptionalString(value)) {
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

export function presentKernelChatMessageParts(
  kernelMessage: KernelChatMessage,
): KernelChatMessagePartsPresentation {
  const textParts = kernelMessage.parts
    .filter((part) => part.kind === 'text')
    .map((part) => normalizeOptionalString(part.text))
    .filter((value): value is string => Boolean(value));
  const reasoningParts = kernelMessage.parts
    .filter((part) => part.kind === 'reasoning')
    .map((part) => normalizeOptionalString(part.text))
    .filter((value): value is string => Boolean(value));
  const attachments = kernelMessage.parts
    .filter((part) => part.kind === 'attachment')
    .map((part) => ({ ...part.attachment }));
  const toolCards = kernelMessage.parts.flatMap((part): OpenClawToolCard[] => {
    if (part.kind === 'toolCall') {
      const detail =
        normalizeOptionalString(part.argumentsText) ??
        normalizeOptionalString(part.detail) ??
        undefined;
      return [
        {
          kind: 'call',
          name: part.toolName,
          ...(normalizeOptionalString(part.toolCallId)
            ? { toolCallId: normalizeOptionalString(part.toolCallId)! }
            : {}),
          ...(normalizeOptionalString(part.argumentsText)
            ? { argumentsText: normalizeOptionalString(part.argumentsText)! }
            : {}),
          ...(detail ? { detail } : {}),
        },
      ];
    }

    if (part.kind === 'toolResult') {
      const preview =
        normalizeOptionalString(part.preview) ??
        normalizeOptionalString(part.text) ??
        undefined;
      return [
        {
          kind: 'result',
          name: part.toolName,
          ...(normalizeOptionalString(part.toolCallId)
            ? { toolCallId: normalizeOptionalString(part.toolCallId)! }
            : {}),
          ...(normalizeOptionalString(part.text)
            ? { text: normalizeOptionalString(part.text)! }
            : {}),
          isError: part.isError === true,
          ...(preview ? { preview } : {}),
        },
      ];
    }

    return [];
  });
  const notices = kernelMessage.parts.flatMap((part): KernelChatNoticePresentation[] => {
    if (part.kind !== 'notice') {
      return [];
    }

    const text = normalizeOptionalString(part.text);
    if (!text) {
      return [];
    }

    return [
      {
        code: part.code,
        text,
        level: normalizeNoticeLevel(part.level),
      },
    ];
  });

  return {
    content:
      textParts.length > 0
        ? textParts.join('\n\n')
        : kernelMessage.text,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n\n') : null,
    attachments,
    toolCards,
    notices,
  };
}
