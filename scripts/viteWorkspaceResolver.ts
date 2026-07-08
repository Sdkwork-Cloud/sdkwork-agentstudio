import fs from 'node:fs';
import path from 'node:path';
import { resolveCanonicalWorkspaceRootDir } from './workspace-root.mjs';

const WORKSPACE_PACKAGE_PATTERN = /^@sdkwork\/(claw-[^/]+)$/;
const WORKTREE_WORKSPACE_PACKAGE_PATTERN = /(?:^|[\\/])\.worktrees[\\/][^\\/]+[\\/]packages[\\/](sdkwork-clawstudio-[^\\/]+)([\\/].*)$/;
const WORKTREE_ROOT_PATTERN = /(?:^|[\\/])\.worktrees(?:[\\/]|$)/;
const RESOLVABLE_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const EXTRA_WORKSPACE_PACKAGE_CONFIGS: Array<{
  packageName: string;
  relativePackageDir: string;
  entryBySubpath: Record<string, string | {
    path: string;
    relativeTo: 'package' | 'workspace';
  }>;
}> = [
  {
    packageName: '@sdkwork/core-pc-react',
    relativePackageDir: '../../sdkwork-core/sdkwork-core-pc-react',
    entryBySubpath: {
      './app': 'src/app/index.ts',
      './env': 'src/env/index.ts',
      './runtime': {
        path: 'scripts/shims/core-pc-react-runtime-node.ts',
        relativeTo: 'workspace',
      },
    },
  },
];

function splitSpecifier(specifier: string) {
  const match = specifier.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match?.[1] ?? specifier,
    suffix: match?.[2] ?? '',
  };
}

function stripViteFsPrefix(pathname: string) {
  const normalizedPath = pathname.startsWith('/@fs/')
    ? pathname.slice('/@fs/'.length)
    : pathname;

  return normalizedPath.replace(/^\/([A-Za-z]:[\\/])/, '$1');
}

function normalizeResolvedPath(pathname: string) {
  return stripViteFsPrefix(pathname).replace(/[\\/]+/g, path.sep);
}

function isPathWithinDirectory(candidatePath: string, directoryPath: string) {
  const relativePath = path.relative(
    path.resolve(directoryPath),
    path.resolve(candidatePath),
  );

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveExistingModulePath(candidatePath: string) {
  if (fs.existsSync(candidatePath)) {
    const stat = fs.statSync(candidatePath);
    if (stat.isFile()) {
      return candidatePath;
    }

    if (stat.isDirectory()) {
      for (const extension of RESOLVABLE_SOURCE_EXTENSIONS) {
        const directoryIndexPath = path.join(candidatePath, `index${extension}`);
        if (fs.existsSync(directoryIndexPath)) {
          return directoryIndexPath;
        }
      }
    }
  }

  if (path.extname(candidatePath)) {
    return candidatePath;
  }

  for (const extension of RESOLVABLE_SOURCE_EXTENSIONS) {
    const extensionCandidate = `${candidatePath}${extension}`;
    if (fs.existsSync(extensionCandidate)) {
      return extensionCandidate;
    }
  }

  for (const extension of RESOLVABLE_SOURCE_EXTENSIONS) {
    const directoryIndexPath = path.join(candidatePath, `index${extension}`);
    if (fs.existsSync(directoryIndexPath)) {
      return directoryIndexPath;
    }
  }

  return candidatePath;
}

function resolveCurrentWorkspacePackagePath(
  packageDirName: string,
  relativeSourcePath: string,
  packagesRootDir: string,
) {
  return path.resolve(packagesRootDir, packageDirName, relativeSourcePath);
}

function resolveCanonicalPackagesRootDir(packagesRootDir: string) {
  const workspaceRootDir = path.resolve(packagesRootDir, '..');
  const canonicalWorkspaceRootDir = resolveCanonicalWorkspaceRootDir(workspaceRootDir);
  return path.resolve(canonicalWorkspaceRootDir, 'packages');
}

function resolveExtraWorkspacePackagePath(
  packageName: string,
  subpath: string,
  packagesRootDir: string,
) {
  const config = EXTRA_WORKSPACE_PACKAGE_CONFIGS.find((entry) => entry.packageName === packageName);
  if (!config) {
    return null;
  }

  const entry = config.entryBySubpath[subpath];
  if (!entry) {
    return null;
  }

  const relativeSourcePath = typeof entry === 'string' ? entry : entry.path;
  const baseDir = typeof entry === 'string' || entry.relativeTo === 'package'
    ? path.resolve(
      resolveCanonicalPackagesRootDir(packagesRootDir),
      config.relativePackageDir,
    )
    : path.resolve(packagesRootDir, '..');

  return path.resolve(
    baseDir,
    relativeSourcePath,
  );
}

function remapWorktreeWorkspacePath(pathname: string, packagesRootDir: string) {
  const normalizedPath = normalizeResolvedPath(pathname);
  const match = normalizedPath.match(WORKTREE_WORKSPACE_PACKAGE_PATTERN);

  if (!match) {
    return null;
  }

  const packageDirName = match[1];
  const relativeSourcePath = (match[2] || '').replace(/^[\\/]+/, '');
  return resolveCurrentWorkspacePackagePath(
    packageDirName,
    relativeSourcePath,
    packagesRootDir,
  );
}

function isRelativeSpecifier(pathname: string) {
  return /^\.{1,2}(?:[\\/]|$)/.test(pathname);
}

export function shouldAttemptWorkspaceResolverRemap(
  source: string,
  importer?: string,
  packagesRootDir?: string,
) {
  const { pathname } = splitSpecifier(source);
  const normalizedPathname = stripViteFsPrefix(pathname);

  if (WORKTREE_ROOT_PATTERN.test(normalizedPathname)) {
    if (packagesRootDir && isPathWithinDirectory(normalizeResolvedPath(pathname), packagesRootDir)) {
      return false;
    }
    return true;
  }

  if (!importer || !isRelativeSpecifier(pathname)) {
    return false;
  }

  const importerPathname = splitSpecifier(importer).pathname;
  if (!WORKTREE_ROOT_PATTERN.test(stripViteFsPrefix(importerPathname))) {
    return false;
  }

  if (packagesRootDir && isPathWithinDirectory(normalizeResolvedPath(importerPathname), packagesRootDir)) {
    return false;
  }

  return true;
}

export function shouldEnableWorktreeWorkspaceResolver(
  workspaceRootDir: string,
  env: Record<string, string | undefined> = {},
) {
  const explicit = String(env.SDKWORK_ENABLE_WORKTREE_RESOLVER ?? '').trim().toLowerCase();
  if (explicit === 'true' || explicit === '1') {
    return true;
  }
  if (explicit === 'false' || explicit === '0') {
    return false;
  }

  return WORKTREE_ROOT_PATTERN.test(workspaceRootDir);
}

export function resolveWorkspacePackageAliases(packagesRootDir: string) {
  const localAliases = !fs.existsSync(packagesRootDir)
    ? []
    : fs.readdirSync(packagesRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^sdkwork-clawstudio-[^/]+$/.test(entry.name))
    .map((entry) => ({
      find: entry.name.replace(/^sdkwork-/, '@sdkwork/'),
      replacement: path.resolve(packagesRootDir, entry.name, 'src/index.ts'),
    }));

  const extraAliases = EXTRA_WORKSPACE_PACKAGE_CONFIGS.flatMap((config) => {
    return Object.entries(config.entryBySubpath)
      .map(([subpath]) => {
        const replacement = resolveExtraWorkspacePackagePath(
          config.packageName,
          subpath,
          packagesRootDir,
        );
        return replacement
          ? {
              find: subpath === '.'
                ? config.packageName
                : `${config.packageName}${subpath.slice(1)}`,
              replacement,
            }
          : null;
      })
      .filter(Boolean);
  });

  return [...localAliases, ...extraAliases]
    .sort((left, right) => {
      const bySpecificity = right.find.length - left.find.length;
      return bySpecificity !== 0 ? bySpecificity : left.find.localeCompare(right.find);
    });
}

export function resolveWorkspacePackageEntry(
  source: string,
  packagesRootDir: string,
) {
  const extraWorkspaceMatch = source.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (extraWorkspaceMatch) {
    const directExtraEntry = resolveExtraWorkspacePackagePath(
      extraWorkspaceMatch[1],
      extraWorkspaceMatch[2] ? `.${extraWorkspaceMatch[2]}` : '.',
      packagesRootDir,
    );
    if (directExtraEntry) {
      return directExtraEntry;
    }
  }

  const match = source.match(WORKSPACE_PACKAGE_PATTERN);
  if (!match) {
    return null;
  }

  return resolveCurrentWorkspacePackagePath(
    `sdkwork-${match[1]}`,
    'src/index.ts',
    packagesRootDir,
  );
}

export function remapWorktreeWorkspaceImport(
  source: string,
  importer: string | undefined,
  packagesRootDir: string,
) {
  const directWorkspaceEntry = resolveWorkspacePackageEntry(source, packagesRootDir);
  if (directWorkspaceEntry) {
    return directWorkspaceEntry;
  }

  const { pathname, suffix } = splitSpecifier(source);
  const directWorktreePath = remapWorktreeWorkspacePath(pathname, packagesRootDir);
  if (directWorktreePath) {
    return `${resolveExistingModulePath(directWorktreePath)}${suffix}`;
  }

  if (!importer || !isRelativeSpecifier(pathname)) {
    return null;
  }

  const importerPath = normalizeResolvedPath(splitSpecifier(importer).pathname);
  const resolvedRelativePath = path.resolve(
    path.dirname(importerPath),
    pathname.replace(/[\\/]+/g, path.sep),
  );
  const remappedRelativePath = remapWorktreeWorkspacePath(
    resolvedRelativePath,
    packagesRootDir,
  );

  return remappedRelativePath ? `${resolveExistingModulePath(remappedRelativePath)}${suffix}` : null;
}
