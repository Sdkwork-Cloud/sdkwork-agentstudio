import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';
import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';
import {
  resolveCanonicalWorkspaceRootDir,
  resolveWorkspaceRootDir as resolveWorkspaceRootDirImpl,
} from './workspace-root.mjs';

const __filename = fileURLToPath(import.meta.url);
export const resolveWorkspaceRootDir = resolveWorkspaceRootDirImpl;
export { resolveCanonicalWorkspaceRootDir };

export function createSharedSdkPackageContext({
  currentWorkingDir = process.cwd(),
  env = process.env,
} = {}) {
  const workspaceRoot = resolveWorkspaceRootDir(currentWorkingDir);
  const canonicalWorkspaceRoot = resolveCanonicalWorkspaceRootDir(currentWorkingDir);

  return {
    workspaceRoot,
    canonicalWorkspaceRoot,
    sharedAppSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
    ),
    sharedSdkCommonRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
    ),
    sharedImBackendSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../openchat/sdkwork-im-sdk/sdkwork-im-sdk-typescript/generated/server-openapi',
    ),
    sharedOpenchatImSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../openchat/sdkwork-im-sdk/sdkwork-im-sdk-typescript/composed',
    ),
    sharedOpenchatImWukongimAdapterRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../openchat/sdkwork-im-sdk/sdkwork-im-sdk-typescript/adapter-wukongim',
    ),
    mode: resolveSharedSdkMode(env),
  };
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function statMtimeMs(targetPath) {
  return exists(targetPath) ? fs.statSync(targetPath).mtimeMs : 0;
}

function latestMtimeMs(targetPath) {
  if (!exists(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  return fs.readdirSync(targetPath).reduce((latest, entry) => {
    return Math.max(latest, latestMtimeMs(path.join(targetPath, entry)));
  }, stat.mtimeMs);
}

function resolveSpawnCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (command === 'pnpm') {
    return 'pnpm.cmd';
  }

  return command;
}

function run(command, args, workspaceRoot) {
  const result = spawnSync(resolveSpawnCommand(command), args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertPackageRootExists(packageRoot, packageName) {
  if (exists(packageRoot)) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-packages] Missing ${packageName} source at ${packageRoot}. ` +
      'Restore the local shared SDK source tree or set SDKWORK_SHARED_SDK_MODE=git to materialize the pinned release checkout.',
  );
}

function hasRequiredSharedSdkSources(context) {
  return exists(context.sharedSdkCommonRoot) && exists(context.sharedAppSdkRoot);
}

function hasOptionalSharedImSdkSources(context) {
  return exists(context.sharedImBackendSdkRoot)
    && exists(context.sharedOpenchatImSdkRoot)
    && exists(context.sharedOpenchatImWukongimAdapterRoot);
}

function readPackageManifest(packageRoot) {
  return JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
}

function resolvePackageLinkPath(packageRoot, packageName) {
  return path.join(packageRoot, 'node_modules', ...packageName.split('/'));
}

function createPackageSymlink(linkPath, targetPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(
    path.resolve(targetPath),
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

export function resolveWorkspaceInstalledPackageRoot(packageName, workspaceRoot) {
  const directPackageRoot = path.resolve(
    workspaceRoot,
    'node_modules',
    ...packageName.split('/'),
  );
  if (exists(directPackageRoot)) {
    return directPackageRoot;
  }

  const pnpmRootDir = path.resolve(workspaceRoot, 'node_modules/.pnpm');
  if (!exists(pnpmRootDir)) {
    return null;
  }

  const packageDirPrefix = packageName.replace('/', '+');
  const matchedPackageDir = fs
    .readdirSync(pnpmRootDir)
    .filter((entry) => entry.startsWith(`${packageDirPrefix}@`))
    .sort()
    .at(-1);

  if (matchedPackageDir) {
    const packageRoot = path.resolve(
      pnpmRootDir,
      matchedPackageDir,
      'node_modules',
      ...packageName.split('/'),
    );
    if (exists(packageRoot)) {
      return packageRoot;
    }
  }

  const packageRootSegments = ['node_modules', ...packageName.split('/')];
  const fallbackPackageRoot = fs
    .readdirSync(pnpmRootDir)
    .sort()
    .map((entry) => path.resolve(pnpmRootDir, entry, ...packageRootSegments))
    .find((candidatePackageRoot) => {
      if (!exists(candidatePackageRoot)) {
        return false;
      }

      const manifestPath = path.join(candidatePackageRoot, 'package.json');
      if (!exists(manifestPath)) {
        return false;
      }

      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))?.name === packageName;
      } catch {
        return false;
      }
    });

  return fallbackPackageRoot ?? null;
}

export function ensurePackageDependencyLinks(
  packageRoot,
  workspaceRoot,
  {
    includeDependencies = true,
    includeDevDependencies = true,
    localPackageRoots = {},
  } = {},
) {
  const manifest = readPackageManifest(packageRoot);
  const dependencyNames = [
    ...new Set([
      ...(includeDependencies ? Object.keys(manifest.dependencies ?? {}) : []),
      ...(includeDevDependencies ? Object.keys(manifest.devDependencies ?? {}) : []),
    ]),
  ];
  const repairedPackages = [];

  for (const dependencyName of dependencyNames) {
    const preferredLocalPackageRoot = localPackageRoots[dependencyName];
    const targetPackageRoot = preferredLocalPackageRoot
      ? path.resolve(preferredLocalPackageRoot)
      : resolveWorkspaceInstalledPackageRoot(dependencyName, workspaceRoot);

    if (!targetPackageRoot || !exists(targetPackageRoot)) {
      throw new Error(
        `[prepare-shared-sdk-packages] Missing installed dependency ${dependencyName} required by ${manifest.name ?? packageRoot}. ` +
          `Expected a workspace-installed package under ${workspaceRoot}. Run pnpm install at the workspace root to materialize shared build dependencies.`,
      );
    }

    const linkPath = resolvePackageLinkPath(packageRoot, dependencyName);
    if (exists(linkPath)) {
      continue;
    }

    createPackageSymlink(linkPath, targetPackageRoot);
    repairedPackages.push(dependencyName);
  }

  return repairedPackages;
}

function shouldBuildPackage(packageRoot) {
  const distEntry = path.join(packageRoot, 'dist', 'index.js');
  if (!exists(distEntry)) {
    return true;
  }

  const sourceMtimeMs = Math.max(
    latestMtimeMs(path.join(packageRoot, 'src')),
    statMtimeMs(path.join(packageRoot, 'package.json')),
    statMtimeMs(path.join(packageRoot, 'tsconfig.json')),
    statMtimeMs(path.join(packageRoot, 'vite.config.ts')),
  );

  return sourceMtimeMs > statMtimeMs(distEntry);
}

function ensurePackageBuilt(filterName, packageRoot, workspaceRoot) {
  if (!shouldBuildPackage(packageRoot)) {
    return;
  }

  console.log(`[prepare-shared-sdk-packages] Building ${filterName}.`);
  run('pnpm', ['--filter', filterName, 'build'], workspaceRoot);
}

export function prepareSharedSdkPackages({
  currentWorkingDir = process.cwd(),
  env = process.env,
  syncExistingRepos = false,
} = {}) {
  const context = createSharedSdkPackageContext({
    currentWorkingDir,
    env,
  });

  if (
    context.mode === 'git' ||
    !hasRequiredSharedSdkSources(context)
  ) {
    console.log('[prepare-shared-sdk-packages] Ensuring shared SDK sources are available.');
    ensureSharedSdkGitSources({
      workspaceRootDir: context.canonicalWorkspaceRoot,
      env,
      syncExistingRepos,
    });
  }

  assertPackageRootExists(context.sharedSdkCommonRoot, '@sdkwork/sdk-common');
  assertPackageRootExists(context.sharedAppSdkRoot, '@sdkwork/app-sdk');

  const needsSharedSdkCommonBuild = shouldBuildPackage(context.sharedSdkCommonRoot);
  ensurePackageDependencyLinks(context.sharedSdkCommonRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedSdkCommonBuild,
  });
  ensurePackageBuilt('@sdkwork/sdk-common', context.sharedSdkCommonRoot, context.workspaceRoot);
  const needsSharedAppSdkBuild = shouldBuildPackage(context.sharedAppSdkRoot);
  ensurePackageDependencyLinks(context.sharedAppSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedAppSdkBuild,
    localPackageRoots: {
      '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/app-sdk', context.sharedAppSdkRoot, context.workspaceRoot);

  if (!hasOptionalSharedImSdkSources(context)) {
    console.log(
      '[prepare-shared-sdk-packages] Skipping optional openchat shared IM SDK preparation because the source roots are absent in this workspace.',
    );
    return context;
  }

  assertPackageRootExists(context.sharedImBackendSdkRoot, '@sdkwork/im-backend-sdk');
  assertPackageRootExists(context.sharedOpenchatImWukongimAdapterRoot, '@openchat/sdkwork-im-wukongim-adapter');
  assertPackageRootExists(context.sharedOpenchatImSdkRoot, '@openchat/sdkwork-im-sdk');

  const needsSharedImBackendSdkBuild = shouldBuildPackage(context.sharedImBackendSdkRoot);
  ensurePackageDependencyLinks(context.sharedImBackendSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedImBackendSdkBuild,
    localPackageRoots: {
      '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/im-backend-sdk', context.sharedImBackendSdkRoot, context.workspaceRoot);

  const needsSharedOpenchatImWukongimAdapterBuild = shouldBuildPackage(
    context.sharedOpenchatImWukongimAdapterRoot,
  );
  ensurePackageDependencyLinks(context.sharedOpenchatImWukongimAdapterRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedOpenchatImWukongimAdapterBuild,
  });
  ensurePackageBuilt(
    '@openchat/sdkwork-im-wukongim-adapter',
    context.sharedOpenchatImWukongimAdapterRoot,
    context.workspaceRoot,
  );

  const needsSharedOpenchatImSdkBuild = shouldBuildPackage(context.sharedOpenchatImSdkRoot);
  ensurePackageDependencyLinks(context.sharedOpenchatImSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedOpenchatImSdkBuild,
    localPackageRoots: {
      '@sdkwork/im-backend-sdk': context.sharedImBackendSdkRoot,
      '@openchat/sdkwork-im-wukongim-adapter': context.sharedOpenchatImWukongimAdapterRoot,
    },
  });
  ensurePackageBuilt('@openchat/sdkwork-im-sdk', context.sharedOpenchatImSdkRoot, context.workspaceRoot);

  return context;
}

function main() {
  prepareSharedSdkPackages();
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
