import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function extractChatHttpPayloadTextFragments(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return payload ? [normalizeChatMessageTextEncoding(payload)] : [];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractChatHttpPayloadTextFragments(entry));
  }

  const record = payload as Record<string, unknown>;

  if (record.choices) {
    return extractChatHttpPayloadTextFragments(record.choices);
  }

  if (record.delta !== undefined) {
    if (typeof record.delta === 'string') {
      return record.delta ? [normalizeChatMessageTextEncoding(record.delta)] : [];
    }

    return extractChatHttpPayloadTextFragments(record.delta);
  }

  if (record.message) {
    return extractChatHttpPayloadTextFragments(record.message);
  }

  if (record.data) {
    return extractChatHttpPayloadTextFragments(record.data);
  }

  if (Array.isArray(record.content)) {
    return record.content.flatMap((entry) => extractChatHttpPayloadTextFragments(entry));
  }

  if (typeof record.content === 'string') {
    return record.content ? [normalizeChatMessageTextEncoding(record.content)] : [];
  }

  if (typeof record.text === 'string') {
    return record.text ? [normalizeChatMessageTextEncoding(record.text)] : [];
  }

  return [];
}

function parseSseFrame(frame: string) {
  const lines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const eventType =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim() || null;
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  return {
    eventType,
    dataLines: dataLines.length > 0 ? dataLines : lines,
  };
}

function shouldIgnoreEventType(eventType: string | null) {
  if (!eventType) {
    return false;
  }

  if (eventType === 'response.output_text.done') {
    return true;
  }

  if (eventType.startsWith('hermes.tool.')) {
    return true;
  }

  if (
    eventType.startsWith('response.') &&
    eventType !== 'response.output_text.delta'
  ) {
    return true;
  }

  return false;
}

function extractEventText(eventType: string | null, payload: unknown) {
  if (eventType === 'response.output_text.delta') {
    const delta = normalizeOptionalString(asRecord(payload)?.delta);
    return delta ? [normalizeChatMessageTextEncoding(delta)] : [];
  }

  return extractChatHttpPayloadTextFragments(payload);
}

export function extractChatHttpStreamTextDeltas(frame: string): string[] {
  const { eventType, dataLines } = parseSseFrame(frame);
  if (shouldIgnoreEventType(eventType)) {
    return [];
  }

  const deltas: string[] = [];
  for (const payloadText of dataLines) {
    if (!payloadText || payloadText === '[DONE]') {
      continue;
    }

    try {
      deltas.push(...extractEventText(eventType, JSON.parse(payloadText)));
      continue;
    } catch {
      if (!eventType || eventType === 'message') {
        deltas.push(normalizeChatMessageTextEncoding(payloadText));
      }
    }
  }

  return deltas;
}

export function isLikelyChatHttpProtocolFrame(chunk: string) {
  const trimmed = chunk.trim();
  return trimmed.startsWith('data:') || trimmed.startsWith('event:');
}
