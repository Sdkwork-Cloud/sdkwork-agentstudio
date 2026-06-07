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

export const OPTIONAL_SHARED_SDK_PACKAGE_PREPARATION_ENV_VAR =
  'SDKWORK_PREPARE_OPTIONAL_SHARED_SDKS';

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
      '../sdkwork-appbase/sdks/sdkwork-appbase-app-sdk/sdkwork-appbase-app-sdk-typescript/generated/server-openapi',
    ),
    sharedMessagingAppSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../sdkwork-messaging/sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/generated/server-openapi',
    ),
    sharedSdkCommonRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
    ),
    sharedCorePcReactRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../sdkwork-core/sdkwork-core-pc-react',
    ),
    sharedLocalApiProxyRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../sdkwork-local-router/packages/pc-react/intelligence/sdkwork-local-api-proxy',
    ),
    sharedImSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../craw-chat/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript',
    ),
    sharedRtcSdkRoot: path.resolve(
      canonicalWorkspaceRoot,
      '../sdkwork-rtc/sdks/sdkwork-rtc-sdk/sdkwork-rtc-sdk-typescript',
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
    : path.resolve(context.canonicalWorkspaceRoot, '../sdkwork-sdk-generator');
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
  return exists(context.sharedSdkCommonRoot)
    && exists(context.sharedAppSdkRoot)
    && exists(context.sharedMessagingAppSdkRoot);
}

function hasOptionalSharedImSdkSources(context) {
  return exists(context.sharedImSdkRoot) && exists(context.sharedRtcSdkRoot);
}

function hasOptionalPcReactSharedSources(context) {
  return exists(context.sharedCorePcReactRoot) && exists(context.sharedLocalApiProxyRoot);
}

function parseBooleanEnvFlag(env, envVarName) {
  const rawValue = env?.[envVarName];
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return false;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  throw new Error(
    `Unsupported ${envVarName} value "${rawValue}". Expected one of: true, false, 1, 0, yes, no, on, off.`,
  );
}

export function shouldPrepareOptionalSharedSdkPackages(env = process.env) {
  return parseBooleanEnvFlag(env, OPTIONAL_SHARED_SDK_PACKAGE_PREPARATION_ENV_VAR);
}

function readPackageManifest(packageRoot) {
  return JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
}

function resolvePackageLinkPath(packageRoot, packageName) {
  return path.join(packageRoot, 'node_modules', ...packageName.split('/'));
}

function resolvePeerTypeDependencyNames(manifest) {
  const peerDependencyNames = new Set(Object.keys(manifest.peerDependencies ?? {}));
  const peerTypeDependencyNames = [];

  if (peerDependencyNames.has('react')) {
    peerTypeDependencyNames.push('@types/react');
  }

  if (peerDependencyNames.has('react-dom')) {
    peerTypeDependencyNames.push('@types/react-dom');
  }

  return peerTypeDependencyNames;
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
    includePeerDependencies = false,
    localPackageRoots = {},
  } = {},
) {
  const manifest = readPackageManifest(packageRoot);
  const peerTypeDependencyNames = new Set(resolvePeerTypeDependencyNames(manifest));
  const dependencyNames = [
    ...new Set([
      ...(includeDependencies ? Object.keys(manifest.dependencies ?? {}) : []),
      ...(includeDevDependencies ? Object.keys(manifest.devDependencies ?? {}) : []),
      ...(includePeerDependencies ? Object.keys(manifest.peerDependencies ?? {}) : []),
      ...(includePeerDependencies ? [...peerTypeDependencyNames] : []),
    ]),
  ];
  const repairedPackages = [];

  for (const dependencyName of dependencyNames) {
    const preferredLocalPackageRoot = localPackageRoots[dependencyName];
    const targetPackageRoot = preferredLocalPackageRoot
      ? path.resolve(preferredLocalPackageRoot)
      : resolveWorkspaceInstalledPackageRoot(dependencyName, workspaceRoot);

    if (!targetPackageRoot || !exists(targetPackageRoot)) {
      if (
        includePeerDependencies
        && manifest.peerDependencies?.[dependencyName]
        && manifest.peerDependenciesMeta?.[dependencyName]?.optional === true
      ) {
        continue;
      }
      if (peerTypeDependencyNames.has(dependencyName)) {
        continue;
      }

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
  assertPackageRootExists(context.sharedAppSdkRoot, '@sdkwork/appbase-app-sdk');
  assertPackageRootExists(context.sharedMessagingAppSdkRoot, '@sdkwork/messaging-app-sdk');
  const prepareOptionalSharedSdkPackages = shouldPrepareOptionalSharedSdkPackages(env);

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
  ensurePackageBuilt('@sdkwork/appbase-app-sdk', context.sharedAppSdkRoot, context.workspaceRoot, sharedSdkBuildEnv);
  const needsSharedMessagingAppSdkBuild = shouldBuildPackage(context.sharedMessagingAppSdkRoot);
  ensurePackageDependencyLinks(context.sharedMessagingAppSdkRoot, context.workspaceRoot, {
    includeDependencies: true,
    includeDevDependencies: needsSharedMessagingAppSdkBuild,
    localPackageRoots: {
      '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
    },
  });
  ensurePackageBuilt('@sdkwork/messaging-app-sdk', context.sharedMessagingAppSdkRoot, context.workspaceRoot, sharedSdkBuildEnv);

  if (prepareOptionalSharedSdkPackages && hasOptionalPcReactSharedSources(context)) {
    ensurePackageDependencyLinks(context.sharedCorePcReactRoot, context.workspaceRoot, {
      includeDependencies: true,
      includeDevDependencies: shouldBuildPackage(context.sharedCorePcReactRoot),
      includePeerDependencies: true,
      localPackageRoots: {
        '@sdkwork/appbase-app-sdk': context.sharedAppSdkRoot,
        '@sdkwork/sdk-common': context.sharedSdkCommonRoot,
        '@sdkwork/im-sdk': context.sharedImSdkRoot,
        '@sdkwork/messaging-app-sdk': context.sharedMessagingAppSdkRoot,
        '@sdkwork/rtc-sdk': context.sharedRtcSdkRoot,
      },
    });
    ensurePackageDependencyLinks(context.sharedLocalApiProxyRoot, context.workspaceRoot, {
      includeDependencies: true,
      includeDevDependencies: shouldBuildPackage(context.sharedLocalApiProxyRoot),
      includePeerDependencies: true,
      localPackageRoots: {
        '@sdkwork/core-pc-react': context.sharedCorePcReactRoot,
      },
    });
  } else if (!prepareOptionalSharedSdkPackages) {
    console.log(
      `[prepare-shared-sdk-packages] Skipping optional shared source package preparation because ${OPTIONAL_SHARED_SDK_PACKAGE_PREPARATION_ENV_VAR} is not enabled.`,
    );
  }

  if (!prepareOptionalSharedSdkPackages) {
    return context;
  }

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
