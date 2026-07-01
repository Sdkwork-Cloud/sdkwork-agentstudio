import type { StudioWorkbenchLLMProviderModelRecord } from '@sdkwork/claw-types';

const OPENCLAW_AGENT_FILE_ID_PREFIX = 'openclaw-agent-file:';
const OPENCLAW_DEFAULT_AGENT_ID = 'main';
const OPENCLAW_VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const OPENCLAW_INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9._-]+/gi;
const OPENCLAW_LEADING_DASH_RE = /^-+/;
const OPENCLAW_TRAILING_DASH_RE = /-+$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getRecordValue(
  value: unknown,
  path: readonly string[],
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

export function getStringValue(
  value: unknown,
  path: readonly string[],
): string | undefined {
  const candidate = getRecordValue(value, path);
  return isNonEmptyString(candidate) ? candidate.trim() : undefined;
}

export function getNumberValue(
  value: unknown,
  path: readonly string[],
): number | undefined {
  const candidate = getRecordValue(value, path);
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

export function getBooleanValue(
  value: unknown,
  path: readonly string[],
): boolean | undefined {
  const candidate = getRecordValue(value, path);
  return typeof candidate === 'boolean' ? candidate : undefined;
}

export function getArrayValue(
  value: unknown,
  path: readonly string[],
): unknown[] | undefined {
  const candidate = getRecordValue(value, path);
  return Array.isArray(candidate) ? candidate : undefined;
}

export function getObjectValue(
  value: unknown,
  path: readonly string[],
): Record<string, unknown> | undefined {
  const candidate = getRecordValue(value, path);
  return isRecord(candidate) ? candidate : undefined;
}

export function titleCaseIdentifier(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeOpenClawAgentId(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return OPENCLAW_DEFAULT_AGENT_ID;
  }

  if (OPENCLAW_VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return (
    trimmed
      .toLowerCase()
      .replace(OPENCLAW_INVALID_AGENT_ID_CHARS_RE, '-')
      .replace(OPENCLAW_LEADING_DASH_RE, '')
      .replace(OPENCLAW_TRAILING_DASH_RE, '')
      .slice(0, 64) || OPENCLAW_DEFAULT_AGENT_ID
  );
}

export function toIsoStringFromMs(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}

export function formatSize(bytes?: number | null) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function inferLanguageFromPath(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith('.json') || lowerPath.endsWith('.json5')) {
    return 'json';
  }
  if (lowerPath.endsWith('.md')) {
    return 'markdown';
  }
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) {
    return 'yaml';
  }
  if (lowerPath.endsWith('.log') || lowerPath.endsWith('.txt')) {
    return 'plaintext';
  }

  return 'plaintext';
}

function buildProviderModelValue(
  id: string,
  role: string,
  existing?: unknown,
) {
  const base = isRecord(existing) ? { ...existing } : {};
  return {
    ...base,
    id,
    name:
      typeof base.name === 'string' && base.name.trim().length > 0
        ? base.name
        : id,
    role,
  };
}

export function upsertOpenClawProviderModels(
  existingModels: unknown[],
  defaultModelId: string,
  reasoningModelId?: string,
  embeddingModelId?: string,
) {
  const existingById = new Map<string, unknown>();
  const passthrough: unknown[] = [];

  existingModels.forEach((item) => {
    if (!isRecord(item) || !isNonEmptyString(item.id)) {
      passthrough.push(item);
      return;
    }
    existingById.set(item.id.trim(), item);
  });

  const normalizedDefaultModelId = defaultModelId.trim();
  const normalizedReasoningModelId = reasoningModelId?.trim() || undefined;
  const normalizedEmbeddingModelId = embeddingModelId?.trim() || undefined;
  const next: Record<string, unknown>[] = [];

  if (normalizedDefaultModelId) {
    next.push(
      buildProviderModelValue(
        normalizedDefaultModelId,
        'primary',
        existingById.get(normalizedDefaultModelId),
      ),
    );
  }

  if (
    normalizedReasoningModelId &&
    normalizedReasoningModelId !== normalizedDefaultModelId
  ) {
    next.push(
      buildProviderModelValue(
        normalizedReasoningModelId,
        'reasoning',
        existingById.get(normalizedReasoningModelId),
      ),
    );
  }

  if (
    normalizedEmbeddingModelId &&
    normalizedEmbeddingModelId !== normalizedDefaultModelId &&
    normalizedEmbeddingModelId !== normalizedReasoningModelId
  ) {
    next.push(
      buildProviderModelValue(
        normalizedEmbeddingModelId,
        'embedding',
        existingById.get(normalizedEmbeddingModelId),
      ),
    );
  }

  for (const [id, item] of existingById.entries()) {
    if (
      id === normalizedDefaultModelId ||
      id === normalizedReasoningModelId ||
      id === normalizedEmbeddingModelId
    ) {
      continue;
    }

    next.push(item as Record<string, unknown>);
  }

  passthrough.forEach((item) => {
    if (isRecord(item)) {
      next.push(item);
    }
  });

  return next;
}

export function mapOpenClawProviderModels(
  models: unknown[],
): StudioWorkbenchLLMProviderModelRecord[] {
  const records: StudioWorkbenchLLMProviderModelRecord[] = [];
  let reasoningTaken = false;
  let embeddingTaken = false;

  models.forEach((model, index) => {
    if (!isRecord(model)) {
      return;
    }

    const id =
      (typeof model.id === 'string' && model.id.trim()) || `model-${index + 1}`;
    const name =
      (typeof model.name === 'string' && model.name.trim()) ||
      (typeof model.label === 'string' && model.label.trim()) ||
      id;
    const isReasoning = model.reasoning === true || model.role === 'reasoning';
    const apiLabel = typeof model.api === 'string' ? model.api.toLowerCase() : '';
    const lowerId = id.toLowerCase();
    const lowerName = name.toLowerCase();
    const isEmbedding =
      lowerId.includes('embed') ||
      lowerName.includes('embed') ||
      apiLabel.includes('embedding') ||
      model.role === 'embedding';

    let role: StudioWorkbenchLLMProviderModelRecord['role'];
    if (isEmbedding && !embeddingTaken) {
      embeddingTaken = true;
      role = 'embedding';
    } else if (isReasoning && !reasoningTaken) {
      reasoningTaken = true;
      role = 'reasoning';
    } else if (index === 0) {
      role = 'primary';
    } else {
      role = 'fallback';
    }

    records.push({
      id,
      name,
      role,
      contextWindow:
        typeof model.contextWindow === 'number' && Number.isFinite(model.contextWindow)
          ? `${model.contextWindow} tokens`
          : 'Unknown',
    });
  });

  if (records[0] && records[0].role === 'fallback') {
    records[0] = {
      ...records[0],
      role: 'primary',
    };
  }

  return records;
}

export function inferProviderCapabilities(models: unknown[]) {
  const capabilities = new Set<string>(['chat']);

  models.forEach((model) => {
    if (!isRecord(model)) {
      return;
    }

    if (model.reasoning === true || model.role === 'reasoning') {
      capabilities.add('reasoning');
    }

    const id = typeof model.id === 'string' ? model.id.toLowerCase() : '';
    const name = typeof model.name === 'string' ? model.name.toLowerCase() : '';
    const apiLabel = typeof model.api === 'string' ? model.api.toLowerCase() : '';
    if (id.includes('embed') || name.includes('embed') || apiLabel.includes('embedding')) {
      capabilities.add('embedding');
    }

    if (Array.isArray(model.input) && model.input.some((entry) => entry === 'image')) {
      capabilities.add('vision');
    }
  });

  return [...capabilities].sort();
}

export function summarizeMarkdown(content: string, maxLength = 220) {
  const normalized = content
    .replace(/^---[\s\S]*?\n---\s*/u, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('```'))
    .join(' ')
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function tokenEstimate(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function buildOpenClawAgentFileId(agentId: string, name: string) {
  return `${OPENCLAW_AGENT_FILE_ID_PREFIX}${encodeURIComponent(agentId)}:${encodeURIComponent(name)}`;
}

export function normalizeOpenClawAgentFileId(fileId: string) {
  const parsed = parseOpenClawAgentFileId(fileId);
  if (!parsed) {
    return fileId;
  }

  return buildOpenClawAgentFileId(normalizeOpenClawAgentId(parsed.agentId), parsed.name);
}

export function parseOpenClawAgentFileId(fileId: string) {
  if (!fileId.startsWith(OPENCLAW_AGENT_FILE_ID_PREFIX)) {
    return null;
  }

  const encoded = fileId.slice(OPENCLAW_AGENT_FILE_ID_PREFIX.length);
  const separatorIndex = encoded.indexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  const encodedAgentId = encoded.slice(0, separatorIndex);
  const encodedName = encoded.slice(separatorIndex + 1);

  try {
    const agentId = decodeURIComponent(encodedAgentId);
    const name = decodeURIComponent(encodedName);
    if (!agentId || !name) {
      return null;
    }
    return { agentId, name };
  } catch {
    return null;
  }
}
