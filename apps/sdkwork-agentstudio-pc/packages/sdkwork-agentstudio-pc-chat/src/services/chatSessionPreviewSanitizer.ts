import { sanitizeChatOperationalMessageText } from './chatMessageStructuredContent.ts';
import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';
import { sanitizeOpenClawPreviewText } from './openClawMessagePresentation.ts';

function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeChatMessageTextEncoding(value.trim());
  return normalized || null;
}

function normalizeKernelId(value: string | null | undefined) {
  const normalized = trimOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function sanitizeChatSessionPreviewText(params: {
  text: string | null | undefined;
  kernelId?: string | null;
}) {
  const preview = trimOptionalString(params.text);
  if (!preview) {
    return undefined;
  }

  if (normalizeKernelId(params.kernelId) === 'openclaw') {
    return sanitizeOpenClawPreviewText(preview);
  }

  const sanitizedPreview = trimOptionalString(sanitizeChatOperationalMessageText(preview));
  return sanitizedPreview ?? undefined;
}
