export function normalizeOpenClawFilePath(path?: string | null) {
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

function isRootedOpenClawFilePath(path: string) {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path) || path.startsWith('//');
}

function shouldCompareOpenClawPathCaseInsensitively(path: string) {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('//');
}

function normalizeOpenClawComparablePath(path: string) {
  return shouldCompareOpenClawPathCaseInsensitively(path) ? path.toLowerCase() : path;
}

function trimComparableOpenClawPathPrefix(path: string, prefix: string) {
  const comparablePath = normalizeOpenClawComparablePath(path);
  const comparablePrefix = normalizeOpenClawComparablePath(prefix);

  if (comparablePath === comparablePrefix) {
    return '';
  }

  if (!comparablePath.startsWith(`${comparablePrefix}/`)) {
    return null;
  }

  return path.slice(prefix.length + 1);
}

export function getWorkbenchPathBasename(path: string) {
  return path.split('/').filter(Boolean).slice(-1)[0] || path;
}

export function trimOpenClawWorkspacePrefix(path: string | null, workspace?: string) {
  const normalizedPath = normalizeOpenClawFilePath(path);
  const normalizedWorkspace = normalizeOpenClawFilePath(workspace);

  if (!normalizedPath || !normalizedWorkspace) {
    return null;
  }

  const relativePath = trimComparableOpenClawPathPrefix(normalizedPath, normalizedWorkspace);
  if (relativePath === '') {
    return null;
  }

  if (relativePath === null) {
    return null;
  }

  return relativePath;
}

function normalizeOpenClawRequestPath(name?: string | null) {
  const normalizedName = normalizeOpenClawFilePath(name);
  if (!normalizedName) {
    return null;
  }

  return normalizedName.replace(/^\/+/, '');
}

export function deriveOpenClawFileRequestPath(
  name: string | null,
  path: string | null,
  workspace?: string,
) {
  const relativeFromWorkspace = trimOpenClawWorkspacePrefix(path, workspace);
  if (relativeFromWorkspace) {
    return relativeFromWorkspace;
  }

  const normalizedPath = normalizeOpenClawFilePath(path);
  if (normalizedPath && !isRootedOpenClawFilePath(normalizedPath)) {
    return normalizedPath;
  }

  const normalizedName = normalizeOpenClawRequestPath(name);
  if (normalizedName) {
    return normalizedName;
  }

  if (!normalizedPath) {
    return null;
  }

  return getWorkbenchPathBasename(normalizedPath);
}
