export type StartupLanguage = 'en' | 'zh';
export type StartupThemeMode = 'light' | 'dark' | 'system';
export type StartupThemeColor =
  | 'lobster'
  | 'tech-blue'
  | 'green-tech'
  | 'zinc'
  | 'violet'
  | 'rose';

export interface StartupAppearanceSnapshot {
  language: StartupLanguage;
  themeColor: StartupThemeColor;
  themeMode: StartupThemeMode;
  isDark: boolean;
}

export interface StartupMilestoneSnapshot {
  hasWindowPresented: boolean;
  hasRuntimeConnected: boolean;
  hasShellBootstrapped: boolean;
  hasShellMounted: boolean;
}

export type StartupBootstrapStage =
  | 'preparing-window'
  | 'connecting-runtime'
  | 'loading-workspace'
  | 'mounting-shell'
  | 'ready';

export interface StartupProgressModel {
  phase: StartupBootstrapStage;
  progress: number;
  statusLabel: string;
}

interface ReadStartupAppearanceOptions {
  storageValue: string | null;
  browserLanguage?: string | null;
  prefersDark: boolean;
}

interface StartupProgressOptions {
  milestones: StartupMilestoneSnapshot;
  language: StartupLanguage;
}

interface StartupMinimumWaitOptions {
  currentTimeMs: number;
  startedAtMs: number;
  minimumVisibleMs: number;
}

interface FullscreenDecisionOptions {
  stage: StartupBootstrapStage;
  isSplashVisible: boolean;
  hasRequestedFullscreen: boolean;
  hasPresentedWindow: boolean;
}

interface StartupCopy {
  title: string;
  preparingWindow: string;
  connectingRuntime: string;
  loadingWorkspace: string;
  mountingShell: string;
  ready: string;
  errorTitle: string;
  retryLabel: string;
}

const DEFAULT_THEME_COLOR: StartupThemeColor = 'lobster';
const DEFAULT_THEME_MODE: StartupThemeMode = 'system';

function normalizeLanguage(language?: string | null): StartupLanguage {
  return typeof language === 'string' && language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function normalizeThemeMode(themeMode: unknown): StartupThemeMode {
  return themeMode === 'light' || themeMode === 'dark' || themeMode === 'system'
    ? themeMode
    : DEFAULT_THEME_MODE;
}

function normalizeThemeColor(themeColor: unknown): StartupThemeColor {
  return themeColor === 'tech-blue' ||
    themeColor === 'green-tech' ||
    themeColor === 'zinc' ||
    themeColor === 'violet' ||
    themeColor === 'rose' ||
    themeColor === 'lobster'
    ? themeColor
    : DEFAULT_THEME_COLOR;
}

function resolveDarkMode(themeMode: StartupThemeMode, prefersDark: boolean) {
  return themeMode === 'dark' || (themeMode === 'system' && prefersDark);
}

export function readStartupAppearanceSnapshot(
  options: ReadStartupAppearanceOptions,
): StartupAppearanceSnapshot {
  try {
    const parsed = options.storageValue ? JSON.parse(options.storageValue) : null;
    const state = parsed?.state ?? parsed ?? {};
    const themeMode = normalizeThemeMode(state.themeMode);

    return {
      language: normalizeLanguage(state.language ?? options.browserLanguage),
      themeColor: normalizeThemeColor(state.themeColor),
      themeMode,
      isDark: resolveDarkMode(themeMode, options.prefersDark),
    };
  } catch {
    const themeMode = DEFAULT_THEME_MODE;

    return {
      language: normalizeLanguage(options.browserLanguage),
      themeColor: DEFAULT_THEME_COLOR,
      themeMode,
      isDark: resolveDarkMode(themeMode, options.prefersDark),
    };
  }
}

export function getStartupCopy(language: StartupLanguage, appName: string): StartupCopy {
  if (language === 'zh') {
    return {
      title: appName,
      preparingWindow: '\u51c6\u5907\u7a97\u53e3',
      connectingRuntime: '\u8fde\u63a5\u684c\u9762\u5f15\u64ce',
      loadingWorkspace: '\u52a0\u8f7d\u5de5\u4f5c\u53f0',
      mountingShell: '\u6253\u5f00\u5de5\u4f5c\u53f0',
      ready: '\u5de5\u4f5c\u53f0\u5df2\u5c31\u7eea',
      errorTitle: '\u542f\u52a8\u5931\u8d25',
      retryLabel: '\u91cd\u8bd5',
    };
  }

  return {
    title: appName,
    preparingWindow: 'Preparing window',
    connectingRuntime: 'Connecting runtime',
    loadingWorkspace: 'Loading workspace',
    mountingShell: 'Opening workspace',
    ready: 'Workspace ready',
    errorTitle: 'Startup failed',
    retryLabel: 'Try again',
  };
}

export function resolveStartupBootstrapStage(
  milestones: StartupMilestoneSnapshot,
): StartupBootstrapStage {
  if (milestones.hasShellMounted) {
    return 'ready';
  }

  if (milestones.hasShellBootstrapped) {
    return 'mounting-shell';
  }

  if (milestones.hasRuntimeConnected) {
    return 'loading-workspace';
  }

  if (milestones.hasWindowPresented) {
    return 'connecting-runtime';
  }

  return 'preparing-window';
}

export function getStartupProgressModel(
  options: StartupProgressOptions,
): StartupProgressModel {
  const copy = getStartupCopy(options.language, 'Claw Studio');
  const stage = resolveStartupBootstrapStage(options.milestones);

  switch (stage) {
    case 'preparing-window':
      return {
        phase: 'preparing-window',
        progress: 12,
        statusLabel: copy.preparingWindow,
      };
    case 'connecting-runtime':
      return {
        phase: 'connecting-runtime',
        progress: 36,
        statusLabel: copy.connectingRuntime,
      };
    case 'loading-workspace':
      return {
        phase: 'loading-workspace',
        progress: 68,
        statusLabel: copy.loadingWorkspace,
      };
    case 'mounting-shell':
      return {
        phase: 'mounting-shell',
        progress: 90,
        statusLabel: copy.mountingShell,
      };
    case 'ready':
      return {
        phase: 'ready',
        progress: 100,
        statusLabel: copy.ready,
      };
  }
}

export function getStartupMinimumWaitMs(options: StartupMinimumWaitOptions) {
  return Math.max(
    0,
    options.minimumVisibleMs - Math.max(0, options.currentTimeMs - options.startedAtMs),
  );
}

export function shouldEnterFullscreenAfterStartup(
  options: FullscreenDecisionOptions,
) {
  return (
    options.stage === 'ready' &&
    !options.isSplashVisible &&
    !options.hasRequestedFullscreen &&
    options.hasPresentedWindow
  );
}
