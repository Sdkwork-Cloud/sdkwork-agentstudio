import type {
  OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot,
  OpenClawMemorySearchResult,
} from '@sdkwork/claw-infrastructure';
import type { InstanceWorkbenchMemoryEntry } from '../types/index.ts';
import {
  getArrayValue,
  getBooleanValue,
  getNumberValue,
  getStringValue,
  isRecord,
  summarizeMarkdown,
  tokenEstimate,
} from './openClawSupport.ts';
import { getWorkbenchPathBasename } from './openClawFilePathSupport.ts';

function inferRuntimeMemoryEntryType(path: string) {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('memory.md') || normalized.includes('/sessions/')) {
    return 'conversation' as const;
  }
  if (
    normalized.includes('runbook') ||
    normalized.includes('playbook') ||
    normalized.includes('guide')
  ) {
    return 'runbook' as const;
  }
  return 'artifact' as const;
}

function inferRuntimeMemoryEntrySource(path: string) {
  return path.toLowerCase().includes('/sessions/') ? ('task' as const) : ('system' as const);
}

function extractRuntimeMemorySnippet(entry: Record<string, unknown>) {
  return (
    getStringValue(entry, ['text']) ||
    getStringValue(entry, ['snippet']) ||
    getStringValue(entry, ['content']) ||
    ''
  );
}

export function formatRuntimeMemoryLineRange(entry: Record<string, unknown>) {
  const start =
    getNumberValue(entry, ['from']) ??
    getNumberValue(entry, ['lineStart']) ??
    getNumberValue(entry, ['startLine']);
  const end =
    getNumberValue(entry, ['to']) ??
    getNumberValue(entry, ['lineEnd']) ??
    getNumberValue(entry, ['endLine']);

  if (typeof start !== 'number' && typeof end !== 'number') {
    return null;
  }

  if (typeof start === 'number' && typeof end === 'number' && end >= start) {
    return `${start}-${end}`;
  }

  return `${start ?? end}`;
}

export function extractDreamDiaryContent(dreamDiaryResult: Record<string, unknown> | null) {
  const inlineContent =
    getStringValue(dreamDiaryResult, ['content']) ||
    getStringValue(dreamDiaryResult, ['text']) ||
    getStringValue(dreamDiaryResult, ['markdown']) ||
    getStringValue(dreamDiaryResult, ['body']);
  if (inlineContent) {
    return inlineContent;
  }

  const lines = (getArrayValue(dreamDiaryResult, ['lines']) || [])
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      if (!isRecord(entry)) {
        return '';
      }
      return getStringValue(entry, ['text']) || getStringValue(entry, ['line']) || '';
    })
    .filter(Boolean);

  return lines.join('\n');
}

export function buildOpenClawRuntimeMemories(
  doctorStatus: Record<string, unknown> | null,
  searchResult: OpenClawMemorySearchResult | null,
  dreamDiaryResult: Record<string, unknown> | null,
  configSnapshot: GatewayOpenClawConfigSnapshot | null,
): InstanceWorkbenchMemoryEntry[] {
  const results = (searchResult?.results || []).filter(isRecord);
  const provider = getStringValue(doctorStatus, ['provider']);
  const agentId = getStringValue(doctorStatus, ['agentId']);
  const embeddingOk = getBooleanValue(doctorStatus, ['embedding', 'ok']);
  const embeddingError = getStringValue(doctorStatus, ['embedding', 'error']);
  const dreamingEnabled = getBooleanValue(doctorStatus, ['dreaming', 'enabled']);
  const dreamingFrequency =
    getStringValue(doctorStatus, ['dreaming', 'frequency']) ||
    getStringValue(configSnapshot?.config, [
      'plugins',
      'entries',
      'memory-core',
      'config',
      'dreaming',
      'frequency',
    ]);
  const dreamDiaryContent = extractDreamDiaryContent(dreamDiaryResult);
  const dreamDiaryPath = getStringValue(dreamDiaryResult, ['path']) || 'dreams.md';
  const dreamDiaryUpdatedAt =
    getStringValue(dreamDiaryResult, ['updatedAt']) ||
    getStringValue(dreamDiaryResult, ['updated_at']) ||
    getStringValue(doctorStatus, ['dreaming', 'lastRunAt']) ||
    'Live';
  const searchDisabled = searchResult?.disabled === true;
  const hasRuntimeSnapshot =
    Boolean(doctorStatus) || results.length > 0 || searchDisabled || Boolean(dreamDiaryContent);

  if (!hasRuntimeSnapshot) {
    return [];
  }

  const statusParts: string[] = [];
  if (provider) {
    statusParts.push(`Provider=${provider}`);
  }
  if (agentId) {
    statusParts.push(`Agent=${agentId}`);
  }
  if (embeddingOk === true) {
    statusParts.push('Embedding ready');
  } else if (embeddingError) {
    statusParts.push(`Embedding issue: ${embeddingError}`);
  }
  if (searchDisabled) {
    statusParts.push('Semantic recall disabled');
  }
  if (dreamingEnabled === true) {
    statusParts.push('Dreaming enabled');
  } else if (dreamingEnabled === false) {
    statusParts.push('Dreaming disabled');
  }
  if (dreamingFrequency) {
    statusParts.push(`Frequency=${dreamingFrequency}`);
  }
  if (results.length > 0) {
    statusParts.push(`${results.length} indexed hit${results.length === 1 ? '' : 's'} available`);
  }

  const entries: InstanceWorkbenchMemoryEntry[] = [
    {
      id: 'memory-runtime',
      title: 'Memory Runtime',
      type: 'fact',
      summary:
        statusParts.length > 0
          ? `${statusParts.join('. ')}.`.replace(/\.\./g, '.')
          : 'Indexed memory runtime is available.',
      source: 'system',
      updatedAt: 'Live',
      retention: embeddingOk === false || searchDisabled ? 'expiring' : 'rolling',
      tokens: 24,
    },
  ];

  results.forEach((result, index) => {
    const path =
      getStringValue(result, ['path']) ||
      getStringValue(result, ['file']) ||
      getStringValue(result, ['uri']) ||
      '';
    const snippet = summarizeMarkdown(extractRuntimeMemorySnippet(result), 220);
    const score = getNumberValue(result, ['score']);
    const lineRange = formatRuntimeMemoryLineRange(result);
    const prefixParts = [path];

    if (lineRange) {
      prefixParts.push(`lines ${lineRange}`);
    }
    if (typeof score === 'number') {
      prefixParts.push(`score ${score.toFixed(2)}`);
    }

    const summary = [prefixParts.filter(Boolean).join(' - '), snippet]
      .filter((part) => part && part.trim())
      .join('. ');

    if (!summary) {
      return;
    }

    entries.push({
      id: `memory-runtime-hit-${index}`,
      title: path ? getWorkbenchPathBasename(path) : `Memory Hit ${index + 1}`,
      type: inferRuntimeMemoryEntryType(path),
      summary,
      source: inferRuntimeMemoryEntrySource(path),
      updatedAt: 'Live',
      retention: 'pinned',
      tokens: tokenEstimate(summary),
    });
  });

  if (dreamDiaryContent) {
    const summary = [dreamDiaryPath, summarizeMarkdown(dreamDiaryContent, 220)]
      .filter((part) => part && part.trim())
      .join('. ');

    entries.push({
      id: 'memory-dream-diary',
      title: 'Dream Diary',
      type: 'dream',
      content: dreamDiaryContent,
      summary,
      source: 'system',
      updatedAt: dreamDiaryUpdatedAt,
      retention: 'rolling',
      tokens: tokenEstimate(dreamDiaryContent),
    });
  }

  return entries;
}
