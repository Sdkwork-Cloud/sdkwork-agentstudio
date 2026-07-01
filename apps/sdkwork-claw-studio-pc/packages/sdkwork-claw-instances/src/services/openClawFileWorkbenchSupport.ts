import type { OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot } from '@sdkwork/claw-infrastructure';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchFile,
  InstanceWorkbenchMemoryEntry,
} from '../types/index.ts';
import {
  buildOpenClawAgentFileId,
  formatSize,
  getArrayValue,
  getStringValue,
  inferLanguageFromPath,
  isRecord,
  normalizeOpenClawAgentId,
  parseOpenClawAgentFileId,
  summarizeMarkdown,
  titleCaseIdentifier,
  tokenEstimate,
  toIsoStringFromMs,
} from './openClawSupport.ts';
import {
  deriveOpenClawFileRequestPath,
  getWorkbenchPathBasename,
} from './openClawFilePathSupport.ts';

export function inferOpenClawFileCategory(
  name: string,
  path: string,
): InstanceWorkbenchFile['category'] {
  const normalized = `${name} ${path}`.toLowerCase();

  if (normalized.includes('memory.md')) {
    return 'memory';
  }
  if (normalized.endsWith('.log')) {
    return 'log';
  }
  if (
    normalized.endsWith('.json') ||
    normalized.endsWith('.json5') ||
    normalized.includes('config')
  ) {
    return 'config';
  }
  if (normalized.endsWith('.md')) {
    return 'prompt';
  }

  return 'artifact';
}

export function mapOpenClawFileEntryToWorkbenchFile(params: {
  agent: InstanceWorkbenchAgent;
  entry: Record<string, unknown>;
  workspace?: string;
  content?: string;
}): InstanceWorkbenchFile | null {
  const entryPath =
    typeof params.entry.path === 'string' && params.entry.path.trim()
      ? params.entry.path.trim()
      : null;
  const requestPath = deriveOpenClawFileRequestPath(
    typeof params.entry.name === 'string' ? params.entry.name : null,
    entryPath,
    params.workspace,
  );
  if (!requestPath) {
    return null;
  }

  const displayName = getWorkbenchPathBasename(requestPath) || requestPath;
  const fallbackPath =
    (params.workspace ? `${params.workspace.replace(/\/+$/, '')}/${requestPath}` : '') ||
    `/${params.agent.agent.id}/${requestPath}`;
  const path = entryPath || fallbackPath;
  const content =
    typeof params.content === 'string'
      ? params.content
      : typeof params.entry.content === 'string'
        ? params.entry.content
        : '';

  return {
    id: buildOpenClawAgentFileId(params.agent.agent.id, requestPath),
    name: displayName,
    path,
    category: inferOpenClawFileCategory(requestPath, path),
    language: inferLanguageFromPath(path),
    size: formatSize(typeof params.entry.size === 'number' ? params.entry.size : undefined),
    updatedAt: toIsoStringFromMs(
      typeof params.entry.updatedAtMs === 'number' ? params.entry.updatedAtMs : undefined,
    ) || 'Unknown',
    status: params.entry.missing === true ? 'missing' : 'synced',
    description: `${requestPath} workspace file for ${params.agent.agent.name}.`,
    content,
    isReadonly: false,
  };
}

export function mergeOpenClawFileCollections(
  baseFiles: InstanceWorkbenchFile[],
  overrideFiles: InstanceWorkbenchFile[],
): InstanceWorkbenchFile[] {
  const mergedFiles = new Map<string, InstanceWorkbenchFile>();

  baseFiles.forEach((file) => {
    mergedFiles.set(file.id, { ...file });
  });

  overrideFiles.forEach((file) => {
    const current = mergedFiles.get(file.id);
    mergedFiles.set(file.id, current ? { ...current, ...file } : { ...file });
  });

  return [...mergedFiles.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function buildOpenClawMemories(
  configSnapshot: GatewayOpenClawConfigSnapshot | null,
  files: InstanceWorkbenchFile[],
  agents: InstanceWorkbenchAgent[],
): InstanceWorkbenchMemoryEntry[] {
  const agentNameById = new Map(agents.map((agent) => [agent.agent.id, agent.agent.name]));
  const backend = getStringValue(configSnapshot?.config, ['memory', 'backend']) || 'builtin';
  const citations = getStringValue(configSnapshot?.config, ['memory', 'citations']) || 'auto';
  const entries: InstanceWorkbenchMemoryEntry[] = [
    {
      id: 'memory-backend',
      title: 'Memory Backend',
      type: 'fact',
      summary: `Backend=${backend}, citations=${citations}.`,
      source: 'system',
      updatedAt:
        getStringValue(configSnapshot?.config, ['meta', 'lastTouchedAt']) || 'Unknown',
      retention: 'rolling',
      tokens: 32,
    },
  ];

  files.forEach((file) => {
    if (file.category !== 'memory' || !file.content.trim()) {
      return;
    }

    const parsed = parseOpenClawAgentFileId(file.id);
    const parsedAgentId = parsed ? normalizeOpenClawAgentId(parsed.agentId) : null;
    const agentName = parsedAgentId
      ? agentNameById.get(parsedAgentId) || titleCaseIdentifier(parsedAgentId)
      : file.name;

    entries.push({
      id: `memory-${file.id}`,
      title: `${agentName} Memory`,
      type: 'conversation',
      summary: summarizeMarkdown(file.content, 220),
      source: parsedAgentId && parsedAgentId !== 'main' ? 'agent' : 'system',
      updatedAt: file.updatedAt,
      retention: 'pinned',
      tokens: tokenEstimate(file.content),
    });
  });

  (getArrayValue(configSnapshot?.config, ['memory', 'qmd', 'paths']) || [])
    .filter(isRecord)
    .forEach((entry, index) => {
      const path = getStringValue(entry, ['path']);
      if (!path) {
        return;
      }

      entries.push({
        id: `qmd-${index}`,
        title: getStringValue(entry, ['name']) || path,
        type: 'artifact',
        summary: `QMD index path ${path}${
          getStringValue(entry, ['pattern'])
            ? ` (pattern: ${getStringValue(entry, ['pattern'])})`
            : ''
        }`,
        source: 'system',
        updatedAt: 'Configured',
        retention: 'rolling',
        tokens: 16,
      });
    });

  return entries;
}
