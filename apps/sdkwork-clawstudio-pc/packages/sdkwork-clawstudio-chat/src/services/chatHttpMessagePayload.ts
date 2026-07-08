import type { StudioConversationAttachment } from '@sdkwork/clawstudio-types';

export type ChatHttpMessageContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
      };
    };

export type ChatHttpRequestMessage = {
  role: 'system' | 'user';
  content: string | ChatHttpMessageContentPart[];
};

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveInlineImageUrl(
  attachment: StudioConversationAttachment,
): string | null {
  if (attachment.kind !== 'image' && attachment.kind !== 'screenshot') {
    return null;
  }

  return (
    normalizeOptionalString(attachment.previewUrl) ??
    normalizeOptionalString(attachment.url) ??
    normalizeOptionalString(attachment.originalUrl)
  );
}

function describeAttachment(
  attachment: StudioConversationAttachment,
  index: number,
) {
  const label = normalizeOptionalString(attachment.name) ?? `Attachment ${index + 1}`;
  const typeLabel = attachment.kind.replace(/-/g, ' ');
  const details = [`${index + 1}. [${typeLabel}] ${label}`];

  const url =
    normalizeOptionalString(attachment.url) ??
    normalizeOptionalString(attachment.originalUrl);
  if (url) {
    details.push(`URL: ${url}`);
  }

  return details.join('\n');
}

function buildAttachmentContextText(params: {
  userText: string;
  attachments: StudioConversationAttachment[];
}) {
  const normalizedText = params.userText.trim();
  if (params.attachments.length === 0) {
    return normalizedText;
  }

  const summary = params.attachments
    .map((attachment, index) => describeAttachment(attachment, index))
    .join('\n');
  const prefix = normalizedText || 'The user sent attachments without additional text.';

  return `${prefix}\n\nAttachments:\n${summary}`;
}

export function buildChatHttpRequestMessages(params: {
  systemInstruction: string;
  userText: string;
  attachments?: StudioConversationAttachment[];
}): ChatHttpRequestMessage[] {
  const attachments = params.attachments?.map((attachment) => ({ ...attachment })) ?? [];
  const inlineImageParts = attachments
    .map((attachment) => {
      const url = resolveInlineImageUrl(attachment);
      return url
        ? ({
            type: 'image_url',
            image_url: {
              url,
            },
          } satisfies ChatHttpMessageContentPart)
        : null;
    })
    .filter((part): part is Extract<ChatHttpMessageContentPart, { type: 'image_url' }> => Boolean(part));
  const nonInlineAttachments = attachments.filter((attachment) => !resolveInlineImageUrl(attachment));

  const userContent =
    inlineImageParts.length > 0
      ? ([
          {
            type: 'text',
            text: buildAttachmentContextText({
              userText: params.userText,
              attachments: nonInlineAttachments,
            }),
          },
          ...inlineImageParts,
        ] satisfies ChatHttpMessageContentPart[])
      : buildAttachmentContextText({
          userText: params.userText,
          attachments,
        });

  return [
    {
      role: 'system',
      content: params.systemInstruction,
    },
    {
      role: 'user',
      content: userContent,
    },
  ];
}
