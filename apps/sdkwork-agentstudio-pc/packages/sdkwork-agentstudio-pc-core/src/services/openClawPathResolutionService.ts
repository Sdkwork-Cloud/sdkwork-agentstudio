function normalizePathSeparators(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function trimTrailingSlash(value: string): string {
  const normalized = normalizePathSeparators(value);
  return normalized.length > 1 ? normalized.replace(/\/+$/g, '') : normalized;
}

function dirname(value: string): string {
  const normalized = trimTrailingSlash(value);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return normalized;
  }
  return normalized.slice(0, index);
}

function basename(value: string): string {
  const normalized = trimTrailingSlash(value);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function joinPath(...parts: string[]): string {
  return normalizePathSeparators(
    parts
      .map((part, index) => (index === 0 ? trimTrailingSlash(part) : part.replace(/^\/+/g, '')))
      .filter(Boolean)
      .join('/'),
  );
}

function isAbsolutePath(value: string): boolean {
  const normalized = normalizePathSeparators(value);
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized);
}

export function resolveOpenClawStateRootFromConfigFile(configFilePath: string): string {
  const configDir = dirname(configFilePath);
  if (basename(configDir) === 'config') {
    return dirname(configDir);
  }
  return configDir;
}

export function resolveOpenClawUserRootFromConfigFile(configFilePath: string): string {
  return dirname(resolveOpenClawStateRootFromConfigFile(configFilePath));
}

export function resolveOpenClawUserPathFromConfigFile(
  configFilePath: string,
  userPath: string,
): string {
  const normalizedUserPath = normalizePathSeparators(userPath);
  if (!normalizedUserPath) {
    return resolveOpenClawStateRootFromConfigFile(configFilePath);
  }
  if (normalizedUserPath === '~') {
    return resolveOpenClawUserRootFromConfigFile(configFilePath);
  }
  if (normalizedUserPath.startsWith('~/')) {
    return joinPath(
      resolveOpenClawUserRootFromConfigFile(configFilePath),
      normalizedUserPath.slice(2),
    );
  }
  if (isAbsolutePath(normalizedUserPath)) {
    return trimTrailingSlash(normalizedUserPath);
  }
  return joinPath(
    resolveOpenClawStateRootFromConfigFile(configFilePath),
    normalizedUserPath.replace(/^\.\//, ''),
  );
}
