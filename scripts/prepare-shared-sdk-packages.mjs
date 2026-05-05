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
    sharedImSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../craw-chat/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript',
    ),
    sharedRtcSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../craw-chat/sdks/sdkwork-rtc-sdk/sdkwork-rtc-sdk-typescript',
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

export function createSharedSdkBuildEnv(context, env = process.env) {
  const explicitGeneratorRoot = typeof env?.SDKWORK_GENERATOR_ROOT === 'string'
    ? env.SDKWORK_GENERATOR_ROOT.trim()
    : '';
  const generatorRoot = explicitGeneratorRoot.length > 0
    ? path.resolve(explicitGeneratorRoot)
    : path.resolve(context.canonicalWorkspaceRoot, '../../sdk/sdkwork-sdk-generator');
  const sdkWorkGeneratorRoot = exists(generatorRoot)
    ? generatorRoot
    : context.workspaceRoot;

  return {
    ...env,
    SDKWORK_GENERATOR_ROOT: sdkWorkGeneratorRoot,
  };
}

function run(command, args, workspaceRoot, env = process.env) {
  const result = spawnSync(resolveSpawnCommand(command), args, {
    cwd: workspaceRoot,
    env,
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
  return exists(context.sharedImSdkRoot) && exists(context.sharedRtcSdkRoot);
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

function ensurePackageBuilt(filterName, packageRoot, workspaceRoot, env = process.env) {
  if (!shouldBuildPackage(packageRoot)) {
    return;
  }

  console.log(`[prepare-shared-sdk-packages] Building ${filterName}.`);
  run('pnpm', ['--filter', filterName, 'build'], workspaceRoot, env);
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
  const sharedSdkBuildEnv = createSharedSdkBuildEnv(context, env);

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
  ensurePackageBuilt('@sdkwork/sdk-common', context.sharedSdkCommonRoot, context.workspaceRoot, sharedSdkBuildEnv);
  const needsSharedAppSdkBuild = shouldBuildPackage(context.sharedAppSdkRoot);
  ensurePackageDependencyLinks(context.sharedAppSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedAppSdkBuild,
    localPackageRoots: {
      '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/app-sdk', context.sharedAppSdkRoot, context.workspaceRoot, sharedSdkBuildEnv);

  if (!hasOptionalSharedImSdkSources(context)) {
    console.log(
      '[prepare-shared-sdk-packages] Skipping optional shared IM/RTC SDK preparation because the source roots are absent in this workspace.',
    );
    return context;
  }

  assertPackageRootExists(context.sharedImSdkRoot, '@sdkwork/im-sdk');
  assertPackageRootExists(context.sharedRtcSdkRoot, '@sdkwork/rtc-sdk');

  const needsSharedImSdkBuild = shouldBuildPackage(context.sharedImSdkRoot);
  ensurePackageDependencyLinks(context.sharedImSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedImSdkBuild,
    localPackageRoots: {
      '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/im-sdk', context.sharedImSdkRoot, context.workspaceRoot, sharedSdkBuildEnv);

  const needsSharedRtcSdkBuild = shouldBuildPackage(context.sharedRtcSdkRoot);
  ensurePackageDependencyLinks(context.sharedRtcSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedRtcSdkBuild,
    localPackageRoots: {
      '@sdkwork/im-sdk': context.sharedImSdkRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/rtc-sdk', context.sharedRtcSdkRoot, context.workspaceRoot, sharedSdkBuildEnv);

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
