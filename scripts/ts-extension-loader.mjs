import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { isSharedSdkSourceMode } from './shared-sdk-mode.mjs';
import {
  resolveCanonicalWorkspaceRootDir,
  resolveWorkspaceRootDir,
} from './workspace-root.mjs';

const FILE_SUFFIXES = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const INDEX_SUFFIXES = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs'];
const WORKSPACE_PACKAGE_EXPORT_CONDITIONS = ['node', 'import', 'default', 'browser'];
const WORKSPACE_PACKAGE_BROWSER_EXPORT_CONDITIONS = ['browser', 'import', 'default', 'node'];
const WORKSPACE_ROOT = resolveWorkspaceRootDir(import.meta.dirname);
const CANONICAL_WORKSPACE_ROOT = resolveCanonicalWorkspaceRootDir(import.meta.dirname);
const WORKSPACE_PACKAGES_ROOT = path.resolve(WORKSPACE_ROOT, 'packages');
const EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS = [
  {
    packageName: '@sdkwork/core-pc-react',
    packageRoot: path.resolve(CANONICAL_WORKSPACE_ROOT, '../sdkwork-core/sdkwork-core-pc-react'),
    entryBySubpath: {
      '.': 'src/index.ts',
      './app': 'src/app/index.ts',
      './env': 'src/env/index.ts',
      './hooks': 'src/hooks/index.ts',
      './im': 'src/im/index.ts',
      './preferences': 'src/preferences/index.ts',
      './runtime': path.resolve(
        WORKSPACE_ROOT,
        'scripts/shims/core-pc-react-runtime-node.ts',
      ),
    },
  },
  {
    packageName: '@sdkwork/auth-pc-react',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/pc-react/iam/sdkwork-auth-pc-react',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
      './auth-service': 'src/auth-service.ts',
    },
  },
  {
    packageName: '@sdkwork/runtime-bootstrap',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/foundation/sdkwork-runtime-bootstrap',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
  {
    packageName: '@sdkwork/iam-contracts',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/iam/sdkwork-iam-contracts',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
  {
    packageName: '@sdkwork/iam-runtime',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/iam/sdkwork-iam-runtime',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
  {
    packageName: '@sdkwork/iam-sdk-adapter',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/iam/sdkwork-iam-sdk-adapter',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
  {
    packageName: '@sdkwork/iam-sdk-ports',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/iam/sdkwork-iam-sdk-ports',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
  {
    packageName: '@sdkwork/iam-service',
    packageRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/packages/common/iam/sdkwork-iam-service',
    ),
    entryBySubpath: {
      '.': 'src/index.ts',
    },
  },
];
const SHARED_SDK_SOURCE_SPECS = [
  {
    packageName: '@sdkwork/appbase-app-sdk',
    sourceRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-appbase/sdks/sdkwork-appbase-app-sdk/sdkwork-appbase-app-sdk-typescript/generated/server-openapi/src',
    ),
  },
  {
    packageName: '@sdkwork/messaging-app-sdk',
    sourceRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-messaging/sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/generated/server-openapi/src',
    ),
  },
  {
    packageName: '@sdkwork/sdk-common',
    sourceRoot: path.resolve(
      CANONICAL_WORKSPACE_ROOT,
      '../sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src',
    ),
  },
];
let workspacePackageSourceEntries = null;

function createWorkspacePackageExportConditions(parentURL) {
  if (!parentURL?.startsWith('file:')) {
    return WORKSPACE_PACKAGE_EXPORT_CONDITIONS;
  }

  const parentPath = fileURLToPath(parentURL);
  const normalizedParentPath = parentPath.replace(/\\/g, '/');
  const isBrowserSourcePath =
    normalizedParentPath.endsWith('.tsx')
    || normalizedParentPath.endsWith('.jsx')
    || normalizedParentPath.includes('/src/components/')
    || normalizedParentPath.includes('/src/hooks/')
    || normalizedParentPath.includes('/src/pages/')
    || normalizedParentPath.includes('/src/application/');
  if (isBrowserSourcePath) {
    return WORKSPACE_PACKAGE_BROWSER_EXPORT_CONDITIONS;
  }

  return WORKSPACE_PACKAGE_EXPORT_CONDITIONS;
}

function resolvePackageExportTarget(exportValue, conditions = WORKSPACE_PACKAGE_EXPORT_CONDITIONS) {
  if (typeof exportValue === 'string') {
    return exportValue;
  }

  if (!exportValue || typeof exportValue !== 'object' || Array.isArray(exportValue)) {
    return null;
  }

  for (const condition of conditions) {
    const target = resolvePackageExportTarget(exportValue[condition], conditions);
    if (target) {
      return target;
    }
  }

  return null;
}

function resolveWorkspacePackageRootExportPath(packageRoot, packageJson, parentURL) {
  const exportsField = packageJson?.exports;
  const rootExport = typeof exportsField === 'string'
    ? exportsField
    : exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)
      ? exportsField['.']
      : null;
  const exportTarget = resolvePackageExportTarget(
    rootExport,
    createWorkspacePackageExportConditions(parentURL),
  );
  if (!exportTarget) {
    return null;
  }

  return findFirstExistingPath(createCandidatePaths(path.resolve(packageRoot, exportTarget)));
}

function isResolvableLocalSpecifier(specifier) {
  return specifier.startsWith('./')
    || specifier.startsWith('../')
    || specifier.startsWith('/')
    || specifier.startsWith('file:')
    || /^[A-Za-z]:[\\/]/.test(specifier);
}

function resolveBasePath(specifier, parentURL) {
  if (specifier.startsWith('file:')) {
    return fileURLToPath(specifier);
  }

  if (path.isAbsolute(specifier)) {
    return specifier;
  }

  const parentPath = parentURL?.startsWith('file:')
    ? fileURLToPath(parentURL)
    : path.join(process.cwd(), 'index.js');

  return path.resolve(path.dirname(parentPath), specifier);
}

function createCandidatePaths(basePath) {
  if (path.extname(basePath)) {
    return [basePath];
  }

  return [
    ...FILE_SUFFIXES.map((suffix) => `${basePath}${suffix}`),
    ...INDEX_SUFFIXES.map((suffix) => path.join(basePath, suffix)),
  ];
}

function findFirstExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function resolveExtraWorkspaceEntryPath(packageRoot, entryPath) {
  return path.isAbsolute(entryPath)
    ? entryPath
    : path.join(packageRoot, entryPath);
}

function getWorkspacePackageSourceEntries() {
  if (workspacePackageSourceEntries) {
    return workspacePackageSourceEntries;
  }

  const entries = new Map();

  if (!fs.existsSync(WORKSPACE_PACKAGES_ROOT)) {
    workspacePackageSourceEntries = entries;
    return entries;
  }

  for (const directoryEntry of fs.readdirSync(WORKSPACE_PACKAGES_ROOT, { withFileTypes: true })) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }

    const packageJsonPath = path.join(
      WORKSPACE_PACKAGES_ROOT,
      directoryEntry.name,
      'package.json',
    );
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (typeof packageJson.name === 'string' && packageJson.name.startsWith('@sdkwork/')) {
        const packageRoot = path.join(WORKSPACE_PACKAGES_ROOT, directoryEntry.name);
        entries.set(packageJson.name, {
          sourceRoot: path.join(packageRoot, 'src'),
          packageRoot,
          packageJson,
          rootEntryPath: resolveWorkspacePackageRootExportPath(packageRoot, packageJson)
            ?? findFirstExistingPath(createCandidatePaths(path.join(packageRoot, 'src', 'index'))),
        });
      }
    } catch {
      // Ignore malformed package manifests in the test loader cache.
    }
  }

  for (const spec of EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS) {
    const packageJsonPath = path.join(spec.packageRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const rootEntryPath = spec.entryBySubpath['.'];
    if (typeof rootEntryPath === 'string') {
      entries.set(spec.packageName, resolveExtraWorkspaceEntryPath(spec.packageRoot, rootEntryPath));
    }
  }

  workspacePackageSourceEntries = entries;
  return entries;
}

function resolveExtraWorkspacePackageSourceAliasPath(specifier) {
  const match = specifier.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }

  const spec = EXTRA_WORKSPACE_PACKAGE_SOURCE_SPECS.find((entry) => entry.packageName === match[1]);
  if (!spec) {
    return null;
  }

  const subpath = match[2]
    ? `.${match[2]}`
    : '.';
  const relativeEntryPath = spec.entryBySubpath[subpath];
  if (!relativeEntryPath) {
    return null;
  }

  return resolveExtraWorkspaceEntryPath(spec.packageRoot, relativeEntryPath);
}

export function resolveSharedSdkSourceAliasPath(specifier, env = process.env) {
  if (!isSharedSdkSourceMode(env)) {
    return null;
  }

  for (const spec of SHARED_SDK_SOURCE_SPECS) {
    if (specifier === spec.packageName) {
      return findFirstExistingPath(createCandidatePaths(path.join(spec.sourceRoot, 'index')));
    }

    if (!specifier.startsWith(`${spec.packageName}/`)) {
      continue;
    }

    const subpath = specifier.slice(spec.packageName.length + 1);
    return findFirstExistingPath(createCandidatePaths(path.join(spec.sourceRoot, subpath)));
  }

  return null;
}

export function resolveWorkspacePackageSourceAliasPath(specifier, parentURL) {
  const extraWorkspacePackageSourceAliasPath = resolveExtraWorkspacePackageSourceAliasPath(specifier);
  if (extraWorkspacePackageSourceAliasPath) {
    return extraWorkspacePackageSourceAliasPath;
  }

  const match = specifier.match(/^(@sdkwork\/[^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }

  const packageSourceEntry = getWorkspacePackageSourceEntries().get(match[1]);
  if (!packageSourceEntry) {
    return null;
  }

  if (!match[2]) {
    if ('packageRoot' in packageSourceEntry && packageSourceEntry.packageRoot) {
      return resolveWorkspacePackageRootExportPath(
        packageSourceEntry.packageRoot,
        packageSourceEntry.packageJson,
        parentURL,
      ) ?? packageSourceEntry.rootEntryPath;
    }

    return packageSourceEntry.rootEntryPath;
  }

  const subpath = match[2].replace(/^\/+/, '');
  return findFirstExistingPath(createCandidatePaths(path.join(packageSourceEntry.sourceRoot, subpath)));
}

export async function resolve(specifier, context, nextResolve) {
  const sharedSdkSourceAliasPath = resolveSharedSdkSourceAliasPath(specifier);
  if (sharedSdkSourceAliasPath) {
    return nextResolve(pathToFileURL(sharedSdkSourceAliasPath).href, context);
  }

  const workspacePackageSourceAliasPath = resolveWorkspacePackageSourceAliasPath(
    specifier,
    context.parentURL,
  );
  if (workspacePackageSourceAliasPath) {
    return nextResolve(pathToFileURL(workspacePackageSourceAliasPath).href, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!isResolvableLocalSpecifier(specifier)) {
      throw error;
    }

    const basePath = resolveBasePath(specifier, context.parentURL);
    const resolvedLocalPath = findFirstExistingPath(createCandidatePaths(basePath));
    if (resolvedLocalPath) {
      return nextResolve(pathToFileURL(resolvedLocalPath).href, context);
    }

    throw error;
  }
}

function shouldTranspileTypeScriptModule(url) {
  if (!url.startsWith('file:')) {
    return false;
  }

  const resolvedPath = fileURLToPath(url);
  return resolvedPath.endsWith('.tsx');
}

export async function load(url, context, nextLoad) {
  if (!shouldTranspileTypeScriptModule(url)) {
    return nextLoad(url, context);
  }

  const resolvedPath = fileURLToPath(url);
  const sourceText = fs.readFileSync(resolvedPath, 'utf8');
  const transpiled = ts.transpileModule(sourceText, {
    fileName: resolvedPath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      verbatimModuleSyntax: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  });

  return {
    format: 'module',
    shortCircuit: true,
    source: transpiled.outputText,
  };
}
