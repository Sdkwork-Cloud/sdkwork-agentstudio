import type {
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: JsonValue | undefined) {
  return isJsonObject(value) ? value : null;
}

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function readScalarPath(value: JsonValue | undefined) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function setCanonicalPath(target: JsonObject, key: string) {
  const current = readScalarPath(target[key]);
  if (current == null) {
    return;
  }

  const normalized = normalizeOpenClawManagedPath(current);
  if (normalized) {
    target[key] = normalized;
    return;
  }

  delete target[key];
}

export function normalizeOpenClawManagedPath(value: string | null | undefined) {
  const normalized = value?.replace(/\\/g, '/').trim() || '';
  if (!normalized) {
    return '';
  }

  return normalized;
}

export function normalizeOpenClawAgentPathOverrides<
  T extends {
    workspace?: string | null;
    agentDir?: string | null;
  },
>(input: T): T {
  return {
    ...input,
    workspace:
      input.workspace == null
        ? input.workspace
        : normalizeOpenClawManagedPath(input.workspace),
    agentDir:
      input.agentDir == null
        ? input.agentDir
        : normalizeOpenClawManagedPath(input.agentDir),
  };
}

export function canonicalizeOpenClawAgentPathsInConfigRoot(root: JsonObject) {
  const agentsRoot = readObject(root.agents);
  if (!agentsRoot) {
    return;
  }

  const defaultsRoot = readObject(agentsRoot.defaults);
  if (defaultsRoot) {
    delete defaultsRoot.workspace;
    delete defaultsRoot.agentDir;
  }

  for (const entry of readArray(agentsRoot.list)) {
    if (!isJsonObject(entry)) {
      continue;
    }

    setCanonicalPath(entry, 'workspace');
    setCanonicalPath(entry, 'agentDir');
  }
}
