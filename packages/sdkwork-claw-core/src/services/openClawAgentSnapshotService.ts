import {
  listOpenClawAgentEntries,
  normalizeOpenClawAgentId,
  readOpenClawAgentModelConfig,
  readOpenClawAgentParams,
  resolveOpenClawDefaultAgentId,
  type OpenClawAgentModelConfig,
  type OpenClawAgentParamValue,
} from './openClawAgentDocumentService.ts';
import {
  normalizeOpenClawAgentPathOverrides,
  normalizeOpenClawLegacyManagedPath,
} from './openClawAgentPathStandardizationService.ts';
import type { JsonObject, JsonValue } from './openClawConfigDocumentService.ts';
import { resolveOpenClawUserPathFromConfigFile } from './openClawPathResolutionService.ts';

export type OpenClawAgentParamSource = 'agent' | 'defaults';

export interface OpenClawAgentSnapshot {
  id: string;
  name: string;
  avatar: string;
  description: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
  model: {
    primary?: string;
    fallbacks: string[];
  };
  params: Record<string, OpenClawAgentParamValue>;
  paramSources: Record<string, OpenClawAgentParamSource>;
}

export interface OpenClawResolvedAgentPaths {
  id: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isJsonObject(value) ? value : null;
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

function titleizeOpenClawIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getAgentSnapshotRoot(root: unknown) {
  return isJsonObject(root) ? root : {};
}

function hasConfiguredModel(config: OpenClawAgentModelConfig) {
  return Boolean(config.primary || config.fallbacks?.length);
}

export function buildOpenClawAgentSnapshotsFromConfigRoot(
  root: unknown,
  configFile: string,
) {
  const normalizedRoot = getAgentSnapshotRoot(root);
  const defaultsRoot = readObject(readObject(normalizedRoot.agents)?.defaults) || {};
  const defaultModel = readOpenClawAgentModelConfig(defaultsRoot.model as JsonValue | undefined);
  const defaultParams = readOpenClawAgentParams(defaultsRoot.params as JsonValue | undefined);
  const defaultAgentId = resolveOpenClawDefaultAgentId(normalizedRoot);
  const defaultWorkspace = normalizeOpenClawLegacyManagedPath(
    readScalar(defaultsRoot.workspace as JsonValue | undefined).trim(),
  );
  const agentEntries = [...listOpenClawAgentEntries(normalizedRoot)].sort((left, right) => {
    const leftId = normalizeOpenClawAgentId(readScalar(left.id));
    const rightId = normalizeOpenClawAgentId(readScalar(right.id));
    if (leftId === defaultAgentId) {
      return -1;
    }
    if (rightId === defaultAgentId) {
      return 1;
    }
    return 0;
  });

  return agentEntries.map((entry): OpenClawAgentSnapshot => {
    const id = normalizeOpenClawAgentId(readScalar(entry.id));
    const name = readScalar(entry.name).trim() || titleizeOpenClawIdentifier(id);
    const identityRoot = readObject(entry.identity) || {};
    const avatar =
      readScalar(identityRoot.emoji as JsonValue | undefined).trim() ||
      readScalar(identityRoot.avatar as JsonValue | undefined).trim() ||
      '*';
    const configuredWorkspace = normalizeOpenClawLegacyManagedPath(
      readScalar(entry.workspace as JsonValue | undefined).trim(),
    );
    const configuredAgentDir = normalizeOpenClawLegacyManagedPath(
      readScalar(entry.agentDir as JsonValue | undefined).trim(),
    );
    const workspace =
      resolveOpenClawUserPathFromConfigFile(
        configFile,
        configuredWorkspace ||
          (id === defaultAgentId ? defaultWorkspace || 'workspace' : `workspace-${id}`),
      ) || resolveOpenClawUserPathFromConfigFile(configFile, `workspace-${id}`);
    const agentDir =
      resolveOpenClawUserPathFromConfigFile(
        configFile,
        configuredAgentDir || `agents/${id}/agent`,
      ) || resolveOpenClawUserPathFromConfigFile(configFile, `agents/${id}/agent`);
    const configuredModel = readOpenClawAgentModelConfig(entry.model as JsonValue | undefined);
    const effectiveModel = hasConfiguredModel(configuredModel) ? configuredModel : defaultModel;
    const agentParams = readOpenClawAgentParams(entry.params as JsonValue | undefined);
    const effectiveParams = {
      ...defaultParams,
      ...agentParams,
    };
    const paramSources = Object.fromEntries(
      Object.keys(effectiveParams).map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(agentParams, key) ? 'agent' : 'defaults',
      ]),
    ) as Record<string, OpenClawAgentParamSource>;

    return {
      id,
      name,
      avatar,
      description: `${name} agent backed by workspace ${workspace}.`,
      workspace,
      agentDir,
      isDefault: id === defaultAgentId,
      model: {
        primary: effectiveModel.primary,
        fallbacks: [...new Set((effectiveModel.fallbacks || []).filter(Boolean))],
      },
      params: effectiveParams,
      paramSources,
    };
  });
}

export function resolveOpenClawAgentPathsFromConfigRoot(input: {
  root: unknown;
  configFile: string;
  agentId: string;
  workspace?: string | null;
  agentDir?: string | null;
}): OpenClawResolvedAgentPaths {
  const normalizedRoot = getAgentSnapshotRoot(input.root);
  const normalizedId = normalizeOpenClawAgentId(input.agentId);
  const defaultsRoot = readObject(readObject(normalizedRoot.agents)?.defaults) || {};
  const defaultAgentId = resolveOpenClawDefaultAgentId(normalizedRoot);
  const defaultWorkspace = normalizeOpenClawLegacyManagedPath(
    readScalar(defaultsRoot.workspace as JsonValue | undefined).trim(),
  );
  const normalizedOverrides = normalizeOpenClawAgentPathOverrides({
    workspace: input.workspace?.trim() || null,
    agentDir: input.agentDir?.trim() || null,
  });
  const workspaceHint =
    normalizedOverrides.workspace ||
    (normalizedId === defaultAgentId
      ? defaultWorkspace || 'workspace'
      : `workspace-${normalizedId}`);
  const agentDirHint = normalizedOverrides.agentDir || `agents/${normalizedId}/agent`;
  const workspace =
    resolveOpenClawUserPathFromConfigFile(input.configFile, workspaceHint) ||
    resolveOpenClawUserPathFromConfigFile(
      input.configFile,
      normalizedId === defaultAgentId ? 'workspace' : `workspace-${normalizedId}`,
    );
  const agentDir =
    resolveOpenClawUserPathFromConfigFile(input.configFile, agentDirHint) ||
    resolveOpenClawUserPathFromConfigFile(input.configFile, `agents/${normalizedId}/agent`);

  return {
    id: normalizedId,
    workspace,
    agentDir,
    isDefault: normalizedId === defaultAgentId,
  };
}
