import type { InstanceWorkbenchAgent, InstanceWorkbenchFile } from '../types/index.ts';
import { normalizeOpenClawAgentId, parseOpenClawAgentFileId } from './openClawSupport.ts';

export interface WorkbenchFileTabState {
  openFileIds: string[];
  activeFileId: string | null;
}

interface WorkbenchFileContentStateInput {
  file: InstanceWorkbenchFile;
  loadedFileContents: Record<string, string>;
  contentStateKey?: string;
  runtimeKind?: string | null;
  transportKind?: string | null;
  isBuiltIn?: boolean;
}

interface WorkbenchFileDraftChangeInput {
  file: InstanceWorkbenchFile | null;
  isFlush?: boolean;
}

export interface WorkbenchFileTabPresentation {
  id: string;
  title: string;
  tooltip: string;
  subtitle?: string;
}

export interface WorkbenchFileContentStateKeyInput {
  instanceId: string;
  scopeKey: string;
  file: InstanceWorkbenchFile;
}

export function normalizeWorkbenchPath(path?: string | null) {
  if (typeof path !== 'string') {
    return null;
  }

  const normalized = path.replace(/\\/g, '/').trim();
  if (!normalized) {
    return null;
  }

  if (normalized === '/') {
    return normalized;
  }

  return normalized.replace(/\/+$/, '');
}

function isRootedWorkbenchPath(path: string) {
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    path.startsWith('//')
  );
}

function shouldCompareWorkbenchPathCaseInsensitively(path: string) {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('//');
}

function normalizeWorkbenchComparablePath(path: string) {
  return shouldCompareWorkbenchPathCaseInsensitively(path) ? path.toLowerCase() : path;
}

function matchesWorkbenchPathPrefix(path: string, prefix: string) {
  const comparablePath = normalizeWorkbenchComparablePath(path);
  const comparablePrefix = normalizeWorkbenchComparablePath(prefix);

  if (comparablePath === comparablePrefix) {
    return true;
  }

  return comparablePath.startsWith(`${comparablePrefix}/`);
}

function trimWorkbenchPathPrefix(path: string, prefix: string) {
  if (!matchesWorkbenchPathPrefix(path, prefix)) {
    return null;
  }

  if (normalizeWorkbenchComparablePath(path) === normalizeWorkbenchComparablePath(prefix)) {
    return '';
  }

  return path.slice(prefix.length + 1);
}

function fileBelongsToAgent(file: InstanceWorkbenchFile, agent: InstanceWorkbenchAgent) {
  const parsed = parseOpenClawAgentFileId(file.id);
  if (parsed) {
    return normalizeOpenClawAgentId(parsed.agentId) === normalizeOpenClawAgentId(agent.agent.id);
  }

  const workspacePath = normalizeWorkbenchPath(agent.workspace);
  const filePath = normalizeWorkbenchPath(file.path);
  if (!workspacePath || !filePath) {
    return false;
  }

  return matchesWorkbenchPathPrefix(filePath, workspacePath);
}

function trimRelativeFilePath(
  normalizedFilePath: string | null,
  agent: InstanceWorkbenchAgent,
  fallbackName: string,
) {
  if (normalizedFilePath && !isRootedWorkbenchPath(normalizedFilePath)) {
    return normalizedFilePath;
  }

  const candidateRoots = [agent.workspace, agent.agentDir]
    .map((value) => normalizeWorkbenchPath(value))
    .filter((value): value is string => Boolean(value));

  for (const rootPath of candidateRoots) {
    if (normalizeWorkbenchComparablePath(normalizedFilePath || '') === normalizeWorkbenchComparablePath(rootPath)) {
      return fallbackName;
    }

    const relativePath = normalizedFilePath ? trimWorkbenchPathPrefix(normalizedFilePath, rootPath) : null;
    if (relativePath !== null) {
      if (relativePath) {
        return relativePath;
      }

      return fallbackName;
    }
  }

  if (!normalizedFilePath) {
    return fallbackName;
  }

  const normalizedName = normalizeWorkbenchPath(fallbackName);
  if (
    normalizedName &&
    normalizeWorkbenchComparablePath(normalizedFilePath).endsWith(
      `/${normalizeWorkbenchComparablePath(normalizedName)}`,
    )
  ) {
    return normalizedName;
  }

  const basename = normalizedFilePath.split('/').filter(Boolean).slice(-1)[0];
  return basename || fallbackName;
}

function getPathBasename(path: string) {
  return path.split('/').filter(Boolean).slice(-1)[0] || path;
}

export function getAgentScopedWorkbenchFiles(
  files: InstanceWorkbenchFile[],
  agent: InstanceWorkbenchAgent | null,
) {
  if (!agent) {
    return [] as InstanceWorkbenchFile[];
  }

  return files
    .filter((file) => fileBelongsToAgent(file, agent))
    .map((file) => {
      const relativePath = trimRelativeFilePath(normalizeWorkbenchPath(file.path), agent, file.name);

      return {
        ...file,
        name: getPathBasename(relativePath),
        path: relativePath,
      };
    });
}

export function getInstanceVisibleWorkbenchFiles(
  files: InstanceWorkbenchFile[],
  agent: InstanceWorkbenchAgent | null,
) {
  if (!agent) {
    return files;
  }

  return getAgentScopedWorkbenchFiles(files, agent);
}

export function reconcileWorkbenchFileTextState(
  files: InstanceWorkbenchFile[],
  state: Record<string, string>,
  resolveStateKey: (file: InstanceWorkbenchFile) => string = (file) => file.id,
) {
  const visibleFileIds = new Set(files.map(resolveStateKey));
  let changed = false;
  const nextState: Record<string, string> = {};

  Object.entries(state).forEach(([fileId, value]) => {
    if (!visibleFileIds.has(fileId)) {
      changed = true;
      return;
    }

    nextState[fileId] = value;
  });

  if (!changed && Object.keys(nextState).length !== Object.keys(state).length) {
    changed = true;
  }

  return changed ? nextState : state;
}

export function buildWorkbenchEditorModelPath(file: InstanceWorkbenchFile) {
  const normalizedPath =
    normalizeWorkbenchPath(file.path)?.replace(/^\/+/, '') ||
    normalizeWorkbenchPath(file.name)?.replace(/^\/+/, '') ||
    'file';
  const encodedPath = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `workbench-file:///${encodeURIComponent(file.id)}/${encodedPath || 'file'}`;
}

export function buildWorkbenchFileTabPresentation(
  file: InstanceWorkbenchFile,
): WorkbenchFileTabPresentation {
  return {
    id: file.id,
    title: file.name,
    tooltip: file.path || file.name,
    subtitle: undefined,
  };
}

export function shouldPersistWorkbenchFileDraftChange(
  input: WorkbenchFileDraftChangeInput,
) {
  if (!input.file || !input.file.id.trim() || input.file.isReadonly) {
    return false;
  }

  return input.isFlush !== true;
}

function isRemoteGatewayWorkbenchFile(input: WorkbenchFileContentStateInput) {
  return input.transportKind === 'openclawGatewayWs' && !input.isBuiltIn;
}

export function buildWorkbenchFileContentStateKey({
  instanceId,
  scopeKey,
  file,
}: WorkbenchFileContentStateKeyInput) {
  return [instanceId, scopeKey, file.id].join('\u001f');
}

function resolveWorkbenchFileContentStateKey(input: WorkbenchFileContentStateInput) {
  return input.contentStateKey || input.file.id;
}

export function shouldLoadWorkbenchFileContent(input: WorkbenchFileContentStateInput) {
  const contentStateKey = resolveWorkbenchFileContentStateKey(input);
  if (Object.prototype.hasOwnProperty.call(input.loadedFileContents, contentStateKey)) {
    return false;
  }

  return isRemoteGatewayWorkbenchFile(input);
}

export function getWorkbenchFileResolvedContent(input: WorkbenchFileContentStateInput) {
  const contentStateKey = resolveWorkbenchFileContentStateKey(input);
  if (Object.prototype.hasOwnProperty.call(input.loadedFileContents, contentStateKey)) {
    return input.loadedFileContents[contentStateKey] || '';
  }

  if (isRemoteGatewayWorkbenchFile(input)) {
    return '';
  }

  return input.file.content;
}

export function createDefaultWorkbenchFileTabState(
  files: InstanceWorkbenchFile[],
): WorkbenchFileTabState {
  const firstFileId = files[0]?.id || null;

  return {
    openFileIds: firstFileId ? [firstFileId] : [],
    activeFileId: firstFileId,
  };
}

export function reconcileWorkbenchFileTabs(
  files: InstanceWorkbenchFile[],
  state: WorkbenchFileTabState,
): WorkbenchFileTabState {
  const visibleFileIds = new Set(files.map((file) => file.id));
  const openFileIds = state.openFileIds.filter((fileId) => visibleFileIds.has(fileId));
  const activeFileId =
    state.activeFileId && visibleFileIds.has(state.activeFileId)
      ? state.activeFileId
      : openFileIds[0] || null;

  return {
    openFileIds,
    activeFileId,
  };
}

export function openWorkbenchFileTab(
  files: InstanceWorkbenchFile[],
  state: WorkbenchFileTabState,
  fileId: string,
): WorkbenchFileTabState {
  if (!files.some((file) => file.id === fileId)) {
    return reconcileWorkbenchFileTabs(files, state);
  }

  const openFileIds = state.openFileIds.includes(fileId)
    ? state.openFileIds
    : [...state.openFileIds, fileId];

  return {
    openFileIds,
    activeFileId: fileId,
  };
}

export function closeWorkbenchFileTab(
  files: InstanceWorkbenchFile[],
  state: WorkbenchFileTabState,
  fileId: string,
): WorkbenchFileTabState {
  const fileIndex = state.openFileIds.indexOf(fileId);
  if (fileIndex === -1) {
    return reconcileWorkbenchFileTabs(files, state);
  }

  const openFileIds = state.openFileIds.filter((openFileId) => openFileId !== fileId);

  if (state.activeFileId !== fileId) {
    return reconcileWorkbenchFileTabs(files, {
      openFileIds,
      activeFileId: state.activeFileId,
    });
  }

  return reconcileWorkbenchFileTabs(files, {
    openFileIds,
    activeFileId: openFileIds[fileIndex] || openFileIds[fileIndex - 1] || null,
  });
}
