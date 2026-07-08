import {
  OPENCLAW_DEFAULT_AGENT_ID,
  ensureSingleDefaultOpenClawAgent,
  listOpenClawAgentEntries,
  normalizeOpenClawAgentId,
  saveOpenClawAgentToConfigRoot,
} from './openClawAgentDocumentService.ts';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';

export interface OpenClawSubagentDefaultsInput {
  maxConcurrent?: number;
  maxSpawnDepth?: number;
  maxChildrenPerAgent?: number;
}

export interface ConfigureOpenClawMultiAgentSupportDocumentInput {
  coordinatorAgentId?: string;
  allowAgentIds: string[];
  subagentDefaults?: OpenClawSubagentDefaultsInput;
  sessionsVisibility?: 'self' | 'tree' | 'agent' | 'all';
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isJsonObject(value) ? value : null;
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!isJsonObject(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function deleteIfEmptyObject(parent: JsonObject, key: string) {
  const current = readObject(parent[key]);
  if (current && Object.keys(current).length === 0) {
    delete parent[key];
  }
}

function readScalar(value: JsonValue | undefined) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function readStringArray(value: JsonValue | undefined) {
  return readArray(value)
    .map((entry) => readScalar(entry).trim())
    .filter(Boolean);
}

function normalizeAgentIdList(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value === '*' ? value : normalizeOpenClawAgentId(value))),
    ),
  ];
}

function setStringArray(target: JsonObject, key: string, values: string[]) {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalizedValues.length === 0) {
    delete target[key];
    return;
  }

  target[key] = normalizedValues as JsonArray;
}

function setMissingPositiveIntegerValue(
  target: JsonObject,
  key: string,
  value: number | undefined,
) {
  if (!Number.isFinite(value)) {
    return;
  }
  if (typeof target[key] === 'number') {
    return;
  }

  target[key] = Math.max(1, Math.floor(value as number));
}

export function configureOpenClawMultiAgentSupportInConfigRoot(
  root: JsonObject,
  input: ConfigureOpenClawMultiAgentSupportDocumentInput,
) {
  const normalizedCoordinatorId = normalizeOpenClawAgentId(
    input.coordinatorAgentId || OPENCLAW_DEFAULT_AGENT_ID,
  );
  const normalizedAllowAgentIds = normalizeAgentIdList([
    normalizedCoordinatorId,
    ...input.allowAgentIds,
  ]);
  const existingCoordinator = listOpenClawAgentEntries(root).find(
    (entry) => normalizeOpenClawAgentId(readScalar(entry.id)) === normalizedCoordinatorId,
  );

  if (!existingCoordinator) {
    saveOpenClawAgentToConfigRoot(root, {
      id: normalizedCoordinatorId,
      isDefault: normalizedCoordinatorId === OPENCLAW_DEFAULT_AGENT_ID,
    });
  }

  const coordinatorEntry = listOpenClawAgentEntries(root).find(
    (entry) => normalizeOpenClawAgentId(readScalar(entry.id)) === normalizedCoordinatorId,
  );
  if (coordinatorEntry) {
    const subagentsRoot = ensureObject(coordinatorEntry, 'subagents');
    const currentAllowAgents = readStringArray(subagentsRoot.allowAgents);
    const nextAllowAgents = normalizeAgentIdList([
      ...currentAllowAgents,
      ...normalizedAllowAgentIds.filter((agentId) => agentId !== normalizedCoordinatorId),
    ]);
    setStringArray(subagentsRoot, 'allowAgents', nextAllowAgents);
    deleteIfEmptyObject(coordinatorEntry, 'subagents');
  }

  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const subagentDefaultsRoot = ensureObject(defaultsRoot, 'subagents');
  setMissingPositiveIntegerValue(
    subagentDefaultsRoot,
    'maxConcurrent',
    input.subagentDefaults?.maxConcurrent,
  );
  setMissingPositiveIntegerValue(
    subagentDefaultsRoot,
    'maxSpawnDepth',
    input.subagentDefaults?.maxSpawnDepth,
  );
  setMissingPositiveIntegerValue(
    subagentDefaultsRoot,
    'maxChildrenPerAgent',
    input.subagentDefaults?.maxChildrenPerAgent,
  );
  deleteIfEmptyObject(defaultsRoot, 'subagents');
  deleteIfEmptyObject(agentsRoot, 'defaults');

  const toolsRoot = ensureObject(root, 'tools');
  const agentToAgentRoot = ensureObject(toolsRoot, 'agentToAgent');
  agentToAgentRoot.enabled = true;
  const currentAllowAgentIds = readStringArray(agentToAgentRoot.allow);
  setStringArray(
    agentToAgentRoot,
    'allow',
    normalizeAgentIdList([...currentAllowAgentIds, ...normalizedAllowAgentIds]),
  );
  deleteIfEmptyObject(toolsRoot, 'agentToAgent');

  if (input.sessionsVisibility) {
    const sessionsRoot = ensureObject(toolsRoot, 'sessions');
    const currentVisibility = readScalar(sessionsRoot.visibility).trim();
    if (!currentVisibility) {
      sessionsRoot.visibility = input.sessionsVisibility;
    }
    deleteIfEmptyObject(toolsRoot, 'sessions');
  }

  deleteIfEmptyObject(root, 'tools');
  ensureSingleDefaultOpenClawAgent(root);
}
