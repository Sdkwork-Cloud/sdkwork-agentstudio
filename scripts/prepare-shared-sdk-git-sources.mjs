import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const SHARED_SDK_APP_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_APP_REPO_URL';
export const SHARED_SDK_COMMON_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMON_REPO_URL';
export const SHARED_SDK_CORE_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_CORE_REPO_URL';
export const SHARED_SDK_IM_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_IM_REPO_URL';
export const SHARED_SDK_RTC_REPO_URL_ENV_VAR = 'SDKWORK_SHARED_SDK_RTC_REPO_URL';
export const SHARED_SDK_APP_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_APP_GIT_REF';
export const SHARED_SDK_COMMON_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_COMMON_GIT_REF';
export const SHARED_SDK_CORE_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_CORE_GIT_REF';
export const SHARED_SDK_IM_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_IM_GIT_REF';
export const SHARED_SDK_RTC_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_RTC_GIT_REF';
export const SHARED_SDK_GIT_REF_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_REF';
export const SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR = 'SDKWORK_SHARED_SDK_GIT_FORCE_SYNC';
export const SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR = 'SDKWORK_SHARED_SDK_RELEASE_CONFIG_PATH';
export const DEFAULT_SHARED_SDK_APP_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git';
export const DEFAULT_SHARED_SDK_COMMON_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-commons.git';
export const DEFAULT_SHARED_SDK_CORE_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-core.git';
export const DEFAULT_SHARED_SDK_IM_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-im-sdk.git';
export const DEFAULT_SHARED_SDK_RTC_REPO_URL = 'https://github.com/Sdkwork-Cloud/sdkwork-rtc-sdk.git';
export const DEFAULT_SHARED_SDK_RELEASE_CONFIG_PATH = 'config/shared-sdk-release-sources.json';

function resolveGitCommand() {
  const configuredCandidates = [
    process.env.GIT_EXE,
    process.env.GIT,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);
  const defaultCandidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\bin\\git.exe',
  ];

  for (const candidate of [...configuredCandidates, ...defaultCandidates]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const whereResult = spawnSync('where.exe', ['git'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (whereResult.status === 0) {
    const resolvedCandidate = (whereResult.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (resolvedCandidate) {
      return resolvedCandidate;
    }
  }

  return 'git.exe';
}

export function resolveSpawnCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (command === 'pnpm') {
    return 'pnpm.cmd';
  }

  if (command === 'git') {
    return resolveGitCommand();
  }

  return command;
}

function run(command, args, { cwd = process.cwd(), captureStdout = false } = {}) {
  const result = spawnSync(resolveSpawnCommand(command), args, {
    cwd,
    encoding: 'utf8',
    stdio: captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return (result.stdout ?? '').trim();
}

function parseBooleanFlag(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function createSourceSpecs(workspaceRootDir) {
  return [
    {
      id: 'app-sdk',
      label: '@sdkwork/app-sdk',
      repoRoot: path.resolve(workspaceRootDir, '../../spring-ai-plus-app-api'),
      packageContainerDirName: 'sdkwork-sdk-app',
      packageDirName: 'sdkwork-app-sdk-typescript',
      monorepoSubmodulePath: 'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
      repoUrlEnvVar: SHARED_SDK_APP_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_APP_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_APP_REPO_URL,
    },
    {
      id: 'sdk-common',
      label: '@sdkwork/sdk-common',
      repoRoot: path.resolve(workspaceRootDir, '../../sdk'),
      packageContainerDirName: 'sdkwork-sdk-commons',
      packageDirName: 'sdkwork-sdk-common-typescript',
      monorepoSubmodulePath: 'spring-ai-plus-business/sdk/sdkwork-sdk-commons',
      repoUrlEnvVar: SHARED_SDK_COMMON_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_COMMON_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_COMMON_REPO_URL,
    },
    {
      id: 'core-pc-react',
      label: '@sdkwork/core-pc-react',
      repoRoot: path.resolve(workspaceRootDir, '../sdkwork-core'),
      packageContainerDirName: '',
      packageDirName: 'sdkwork-core-pc-react',
      monorepoSubmodulePath: '',
      repoUrlEnvVar: SHARED_SDK_CORE_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_CORE_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_CORE_REPO_URL,
    },
    {
      id: 'im-sdk',
      label: '@sdkwork/im-sdk',
      repoRoot: path.resolve(workspaceRootDir, '../craw-chat/sdks/sdkwork-im-sdk'),
      packageContainerDirName: '',
      packageDirName: 'sdkwork-im-sdk-typescript',
      monorepoSubmodulePath: '',
      repoUrlEnvVar: SHARED_SDK_IM_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_IM_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_IM_REPO_URL,
    },
    {
      id: 'rtc-sdk',
      label: '@sdkwork/rtc-sdk',
      repoRoot: path.resolve(workspaceRootDir, '../craw-chat/sdks/sdkwork-rtc-sdk'),
      packageContainerDirName: '',
      packageDirName: 'sdkwork-rtc-sdk-typescript',
      monorepoSubmodulePath: '',
      repoUrlEnvVar: SHARED_SDK_RTC_REPO_URL_ENV_VAR,
      refEnvVar: SHARED_SDK_RTC_GIT_REF_ENV_VAR,
      defaultRepoUrl: DEFAULT_SHARED_SDK_RTC_REPO_URL,
    },
  ];
}

export function resolveSourcePackageContainerRoot(spec) {
  return path.join(spec.repoRoot, spec.packageContainerDirName);
}

export function resolveSourcePackageRoot(spec) {
  return path.join(resolveSourcePackageContainerRoot(spec), spec.packageDirName);
}

export function resolveMonorepoSubmoduleRoot(spec) {
  return path.join(spec.repoRoot, spec.monorepoSubmodulePath);
}

export function resolveMonorepoPackageRoot(spec) {
  return path.join(resolveMonorepoSubmoduleRoot(spec), spec.packageDirName);
}

export function resolveSharedSdkReleaseConfigPath(workspaceRootDir, env = process.env) {
  const configuredPath = typeof env?.[SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR] === 'string'
    ? env[SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR].trim()
    : '';

  return path.resolve(
    workspaceRootDir,
    configuredPath.length > 0 ? configuredPath : DEFAULT_SHARED_SDK_RELEASE_CONFIG_PATH,
  );
}

export function readSharedSdkReleaseConfig(workspaceRootDir, env = process.env) {
  const configPath = resolveSharedSdkReleaseConfigPath(workspaceRootDir, env);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Missing shared SDK release config at ${configPath}.`,
    );
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const sourceMap = rawConfig?.sources;
  if (!sourceMap || typeof sourceMap !== 'object' || Array.isArray(sourceMap)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Invalid shared SDK release config at ${configPath}: missing sources map.`,
    );
  }

  return {
    configPath,
    sources: sourceMap,
  };
}

function extractRepoName(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

  if (normalizedRepoUrl.length === 0) {
    return '';
  }

  const repoName = normalizedRepoUrl.split('/').at(-1) ?? '';
  return repoName.replace(/\.git$/i, '');
}

export function resolveCheckoutRootForRepoUrl(spec, repoUrl) {
  const repoName = extractRepoName(repoUrl);

  if (repoName === spec.packageDirName) {
    return resolveSourcePackageRoot(spec);
  }

  if (repoName === spec.packageContainerDirName) {
    return resolveSourcePackageContainerRoot(spec);
  }

  return spec.repoRoot;
}

export function resolvePackageRootForCheckoutRoot(spec, checkoutRoot) {
  const normalizedCheckoutRoot = path.resolve(checkoutRoot);
  const packageRoot = path.resolve(resolveSourcePackageRoot(spec));

  if (normalizedCheckoutRoot === packageRoot) {
    return packageRoot;
  }

  return packageRoot;
}

export function parseGitSubmodulePaths(gitmodulesContent) {
  const submodulePaths = new Set();
  const matches = String(gitmodulesContent ?? '').matchAll(/^\s*path\s*=\s*(.+)\s*$/gm);

  for (const match of matches) {
    if (match[1]) {
      submodulePaths.add(match[1].trim());
    }
  }

  return submodulePaths;
}

function readGitSubmodulePaths(repoRoot) {
  const gitmodulesPath = path.join(repoRoot, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    return new Set();
  }

  return parseGitSubmodulePaths(fs.readFileSync(gitmodulesPath, 'utf8'));
}

function resolveGitDirectoryFromCheckoutRoot(checkoutRoot) {
  const gitEntryPath = path.join(checkoutRoot, '.git');
  if (!fs.existsSync(gitEntryPath)) {
    return '';
  }

  const gitEntryStat = fs.lstatSync(gitEntryPath);
  if (gitEntryStat.isDirectory()) {
    return gitEntryPath;
  }

  if (!gitEntryStat.isFile()) {
    return '';
  }

  const pointerSource = fs.readFileSync(gitEntryPath, 'utf8');
  const pointerMatch = pointerSource.match(/^\s*gitdir:\s*(.+)\s*$/m);
  if (!pointerMatch?.[1]) {
    return '';
  }

  return path.resolve(checkoutRoot, pointerMatch[1].trim());
}

function findGitCheckoutInfo(startPath) {
  let currentPath = path.resolve(startPath);

  while (true) {
    const gitDirectory = resolveGitDirectoryFromCheckoutRoot(currentPath);
    if (gitDirectory) {
      return {
        checkoutRoot: currentPath,
        gitDirectory,
      };
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

function readGitConfigSource(startPath) {
  const checkoutInfo = findGitCheckoutInfo(startPath);
  if (!checkoutInfo) {
    return '';
  }

  const configPath = path.join(checkoutInfo.gitDirectory, 'config');
  if (!fs.existsSync(configPath)) {
    return '';
  }

  return fs.readFileSync(configPath, 'utf8');
}

function ensureDirectoryLink(linkPath, targetPath) {
  const normalizedTargetPath = path.resolve(targetPath);

  if (fs.existsSync(linkPath)) {
    const linkStat = fs.lstatSync(linkPath);
    const resolvedExistingPath = path.resolve(fs.realpathSync(linkPath));

    if (resolvedExistingPath === normalizedTargetPath) {
      return;
    }

    if (linkStat.isSymbolicLink()) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Existing symbolic link at ${linkPath} does not point to ${targetPath}.`,
      );
    }

    throw new Error(
      `[prepare-shared-sdk-git-sources] Cannot materialize ${linkPath} because it already exists and does not point to ${targetPath}.`,
    );
  }

  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

export function materializePackageRootFromMonorepo(spec) {
  const packageRoot = resolveSourcePackageRoot(spec);
  if (fs.existsSync(packageRoot)) {
    return packageRoot;
  }

  const submodulePaths = readGitSubmodulePaths(spec.repoRoot);
  if (!submodulePaths.has(spec.monorepoSubmodulePath)) {
    return packageRoot;
  }

  run('git', [
    '-C',
    spec.repoRoot,
    'submodule',
    'update',
    '--init',
    '--depth',
    '1',
    '--',
    spec.monorepoSubmodulePath,
  ]);

  const monorepoSubmoduleRoot = resolveMonorepoSubmoduleRoot(spec);
  const monorepoPackageRoot = resolveMonorepoPackageRoot(spec);
  if (!fs.existsSync(monorepoPackageRoot)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} monorepo package root at ${monorepoPackageRoot}.`,
    );
  }

  ensureDirectoryLink(resolveSourcePackageContainerRoot(spec), monorepoSubmoduleRoot);
  return packageRoot;
}

export function isGitCheckout(repoRoot) {
  return Boolean(findGitCheckoutInfo(repoRoot));
}

export function detectExistingOriginUrl(repoRoot) {
  if (!isGitCheckout(repoRoot)) {
    return '';
  }

  const gitConfigSource = readGitConfigSource(repoRoot);
  const remoteOriginMatch = gitConfigSource.match(
    /\[remote\s+"origin"\][\s\S]*?^\s*url\s*=\s*(.+)\s*$/m,
  );
  if (remoteOriginMatch?.[1]) {
    return remoteOriginMatch[1].trim();
  }

  try {
    return run('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
      captureStdout: true,
    });
  } catch {
    return '';
  }
}

export function resolveRemoteDefaultBranch(repoUrl) {
  const output = run('git', ['ls-remote', '--symref', repoUrl, 'HEAD'], {
    captureStdout: true,
  });
  const match = output.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
  if (match?.[1]) {
    return match[1];
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Unable to resolve the remote default branch for ${repoUrl}.`,
  );
}

function readConfiguredSource(spec, workspaceRootDir, env) {
  const { configPath, sources } = readSharedSdkReleaseConfig(workspaceRootDir, env);
  const configuredSource = sources?.[spec.id];

  if (!configuredSource || typeof configuredSource !== 'object' || Array.isArray(configuredSource)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Missing ${spec.id} source in ${configPath}.`,
    );
  }

  return configuredSource;
}

function resolveRepoUrl(spec, workspaceRootDir, env) {
  const explicitUrl = typeof env?.[spec.repoUrlEnvVar] === 'string'
    ? env[spec.repoUrlEnvVar].trim()
    : '';
  if (explicitUrl.length > 0) {
    return explicitUrl;
  }

  const configuredSource = readConfiguredSource(spec, workspaceRootDir, env);
  if (typeof configuredSource.repoUrl === 'string' && configuredSource.repoUrl.trim().length > 0) {
    return configuredSource.repoUrl.trim();
  }

  for (const checkoutRoot of [
    resolveSourcePackageRoot(spec),
    resolveSourcePackageContainerRoot(spec),
    spec.repoRoot,
  ]) {
    const existingOriginUrl = detectExistingOriginUrl(checkoutRoot);
    if (existingOriginUrl.length > 0) {
      return existingOriginUrl;
    }
  }

  if (typeof spec.defaultRepoUrl === 'string' && spec.defaultRepoUrl.trim().length > 0) {
    return spec.defaultRepoUrl.trim();
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Missing ${spec.repoUrlEnvVar}.`,
  );
}

function resolveCurrentCheckoutRef(repoRoot) {
  if (!isGitCheckout(repoRoot)) {
    return '';
  }

  try {
    return run('git', ['-C', repoRoot, 'branch', '--show-current'], {
      captureStdout: true,
    });
  } catch {
    return '';
  }
}

function resolveTargetRef({ repoUrl, spec, workspaceRootDir, env, checkoutRoot, syncExistingRepos }) {
  const explicitPerRepoRef = typeof env?.[spec.refEnvVar] === 'string' ? env[spec.refEnvVar].trim() : '';
  if (explicitPerRepoRef.length > 0) {
    return explicitPerRepoRef;
  }

  const configuredSource = readConfiguredSource(spec, workspaceRootDir, env);
  if (typeof configuredSource.ref === 'string' && configuredSource.ref.trim().length > 0) {
    return configuredSource.ref.trim();
  }

  const explicitGlobalRef = typeof env?.[SHARED_SDK_GIT_REF_ENV_VAR] === 'string'
    ? env[SHARED_SDK_GIT_REF_ENV_VAR].trim()
    : '';
  if (explicitGlobalRef.length > 0) {
    return explicitGlobalRef;
  }

  if (!syncExistingRepos) {
    const currentCheckoutRef = resolveCurrentCheckoutRef(checkoutRoot);
    if (currentCheckoutRef.length > 0) {
      return currentCheckoutRef;
    }
  }

  return resolveRemoteDefaultBranch(repoUrl);
}

function isExplicitGitTransportUrl(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '').trim();
  if (normalizedRepoUrl.length === 0) {
    return false;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedRepoUrl)) {
    return true;
  }

  if (/^[^@/\\\s]+@[^:/\\\s]+:.+/.test(normalizedRepoUrl)) {
    return true;
  }

  if (/^[A-Za-z]:([\\/]|$)/.test(normalizedRepoUrl)) {
    return false;
  }

  return /^[^:/\\\s]+:.+/.test(normalizedRepoUrl);
}

export function resolveGitCloneRepoUrl(repoUrl) {
  const normalizedRepoUrl = String(repoUrl ?? '').trim();
  if (normalizedRepoUrl.length === 0) {
    return normalizedRepoUrl;
  }

  if (isExplicitGitTransportUrl(normalizedRepoUrl)) {
    return normalizedRepoUrl;
  }

  return pathToFileURL(path.resolve(normalizedRepoUrl)).href;
}

function assertGitCheckoutIsClean(repoRoot, label) {
  const statusOutput = run('git', ['-C', repoRoot, 'status', '--porcelain'], {
    captureStdout: true,
  });
  if (statusOutput.length === 0) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-git-sources] Refusing to update ${label} at ${repoRoot} because the checkout has uncommitted changes.`,
  );
}

function cloneSourceRepo({ repoRoot, repoUrl, targetRef }) {
  const cloneRepoUrl = resolveGitCloneRepoUrl(repoUrl);
  fs.mkdirSync(path.dirname(repoRoot), { recursive: true });
  run('git', ['clone', '--depth', '1', cloneRepoUrl, repoRoot]);
  run('git', ['-C', repoRoot, 'fetch', '--depth', '1', 'origin', targetRef]);
  run('git', ['-c', 'advice.detachedHead=false', '-C', repoRoot, 'checkout', '--force', 'FETCH_HEAD']);
}

function syncExistingSourceRepo({ repoRoot, repoUrl, targetRef, label }) {
  assertGitCheckoutIsClean(repoRoot, label);
  run('git', ['-C', repoRoot, 'remote', 'set-url', 'origin', repoUrl]);
  run('git', ['-C', repoRoot, 'fetch', '--depth', '1', 'origin', targetRef]);
  run('git', ['-c', 'advice.detachedHead=false', '-C', repoRoot, 'checkout', '--force', 'FETCH_HEAD']);
}

function ensureSourceSpecReady(spec, workspaceRootDir, env, syncExistingRepos) {
  const repoUrl = resolveRepoUrl(spec, workspaceRootDir, env);
  const checkoutRoot = resolveCheckoutRootForRepoUrl(spec, repoUrl);
  const hasGitCheckout = isGitCheckout(checkoutRoot);
  const targetRef = resolveTargetRef({
    repoUrl,
    spec,
    workspaceRootDir,
    env,
    checkoutRoot,
    syncExistingRepos,
  });

  if (!hasGitCheckout) {
    if (fs.existsSync(checkoutRoot) && fs.readdirSync(checkoutRoot).length > 0) {
      throw new Error(
        `[prepare-shared-sdk-git-sources] Expected ${checkoutRoot} to be a git checkout for ${spec.label}.`,
      );
    }

    cloneSourceRepo({
      repoRoot: checkoutRoot,
      repoUrl,
      targetRef,
    });
  } else if (syncExistingRepos) {
    syncExistingSourceRepo({
      repoRoot: checkoutRoot,
      repoUrl,
      targetRef,
      label: spec.label,
    });
  }

  let packageRoot = resolvePackageRootForCheckoutRoot(spec, checkoutRoot);

  if (!fs.existsSync(packageRoot) && path.resolve(checkoutRoot) === path.resolve(spec.repoRoot)) {
    packageRoot = materializePackageRootFromMonorepo(spec);
  }

  if (!fs.existsSync(packageRoot)) {
    throw new Error(
      `[prepare-shared-sdk-git-sources] Expected ${spec.label} package root at ${packageRoot}.`,
    );
  }

  console.log(
    `[prepare-shared-sdk-git-sources] Ready ${spec.label} from ${repoUrl}#${targetRef}.`,
  );

  return {
    ...spec,
    repoUrl,
    targetRef,
    packageRoot,
  };
}

export function ensureSharedSdkGitSources({
  workspaceRootDir = process.cwd(),
  env = process.env,
  syncExistingRepos = parseBooleanFlag(env?.CI) || parseBooleanFlag(env?.[SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR]),
} = {}) {
  return createSourceSpecs(workspaceRootDir).map((spec) => {
    return ensureSourceSpecReady(spec, workspaceRootDir, env, syncExistingRepos);
  });
}

function main() {
  ensureSharedSdkGitSources();
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
