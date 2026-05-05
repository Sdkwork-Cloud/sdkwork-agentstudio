import path from 'node:path';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function createRemovedOpenClawEntry({ id, relativePathParts }) {
  const fileName = relativePathParts.at(-1);
  const slashRelativePath = relativePathParts.join('/');

  return Object.freeze({
    id,
    relativePathParts: Object.freeze([...relativePathParts]),
    relativePath: path.join(...relativePathParts),
    slashRelativePath,
    fileName,
    fileNamePattern: new RegExp(escapeRegExp(fileName), 'u'),
    slashRelativePathPattern: new RegExp(
      slashRelativePath.split('/').map(escapeRegExp).join('[/\\\\]'),
      'u',
    ),
  });
}

export const REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY = createRemovedOpenClawEntry({
  id: 'removedOpenClawReleaseConfig',
  relativePathParts: ['config', 'openclaw-release.json'],
});

export const REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY = createRemovedOpenClawEntry({
  id: 'removedOpenClawRuntimeCleanupScript',
  relativePathParts: ['scripts', 'cleanup-legacy-openclaw-source-runtime.mjs'],
});

export const REMOVED_OPENCLAW_UPGRADE_ENTRIES = Object.freeze([
  REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY,
  REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY,
]);

export function resolveRemovedOpenClawWorkspaceEntry(workspaceRootDir, entry) {
  return path.join(workspaceRootDir, ...entry.relativePathParts);
}
