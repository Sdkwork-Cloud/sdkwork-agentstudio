function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function resolveDirectory(filePath: string) {
  return normalizePath(filePath).replace(/\/[^/]+$/, '');
}

function isWithinDirectory(filePath: string, directoryPath: string) {
  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}

const reactVendorPattern = /\/node_modules\/(?:react(?:\/|$)|react-dom(?:\/|$)|scheduler(?:\/|$))/;
const appRouterPattern = /\/node_modules\/(?:react-router-dom(?:\/|$)|react-router(?:\/|$))/;
const appStatePattern = /\/node_modules\/(?:@tanstack\/react-query(?:\/|$)|@tanstack\/query-core(?:\/|$)|zustand(?:\/|$))/;
const i18nRuntimePattern = /\/node_modules\/(?:i18next(?:\/|$)|react-i18next(?:\/|$)|i18next-browser-languagedetector(?:\/|$))/;
const appUiPattern = /\/node_modules\/(?:i18next(?:\/|$)|react-i18next(?:\/|$)|sonner(?:\/|$)|motion(?:\/|$)|@radix-ui\/react-[^/]+(?:\/|$))/;
const communityEditorPattern = /\/node_modules\/(?:@tiptap|prosemirror-|prosemirror\/)/;
const markdownRuntimePattern = /\/node_modules\/(?:react-markdown|remark-gfm|remark-parse|remark-rehype|rehype-raw|unified|mdast-util-|micromark|hast-util-|parse5|property-information|space-separated-tokens|comma-separated-tokens|web-namespaces|react-syntax-highlighter|refractor|prismjs)/;

export const CLAW_VITE_DEDUPE_PACKAGES = [
  'react',
  'react-dom',
  'buffer',
  'base64-js',
  'ieee754',
  'wukongimjssdk',
  'bignumber.js',
  'crypto-js',
  'curve25519-js',
  'md5-typescript',
  '@sdkwork/claw-infrastructure',
  '@sdkwork/claw-i18n',
  '@sdkwork/sdk-common',
] as const;

export interface ClawManualChunkEntries {
  appbaseAppSdkEntry: string;
  messagingAppSdkEntry?: string;
  sdkCommonEntry?: string;
}

function resolveChunkRoot(entry: string | undefined) {
  return entry ? resolveDirectory(normalizePath(entry)) : null;
}

export function createClawManualChunks(entries: ClawManualChunkEntries | string) {
  const normalizedEntries = typeof entries === 'string'
    ? { appbaseAppSdkEntry: entries }
    : entries;
  const appbaseAppSdkRoot = resolveChunkRoot(normalizedEntries.appbaseAppSdkEntry);
  const messagingAppSdkRoot = resolveChunkRoot(normalizedEntries.messagingAppSdkEntry);
  const sdkCommonRoot = resolveChunkRoot(normalizedEntries.sdkCommonEntry);

  return function manualChunks(id: string) {
    const normalizedId = normalizePath(id);

    if (normalizedId.includes('/packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts')) {
      return 'claw-platform-web-studio';
    }

    if (normalizedId.includes('/packages/sdkwork-claw-i18n/src/locales/en/')) {
      return 'claw-i18n-en';
    }

    if (normalizedId.includes('/packages/sdkwork-claw-i18n/src/locales/zh/')) {
      return 'claw-i18n-zh';
    }

    if (
      normalizedId.includes('/packages/sdkwork-claw-i18n/src/') ||
      i18nRuntimePattern.test(normalizedId)
    ) {
      return 'claw-i18n-runtime';
    }

    if (normalizedId.includes('/packages/sdkwork-claw-infrastructure/src/')) {
      return 'claw-infrastructure';
    }

    if (appbaseAppSdkRoot && isWithinDirectory(normalizedId, appbaseAppSdkRoot)) {
      return 'sdkwork-iam-app-sdk';
    }

    if (messagingAppSdkRoot && isWithinDirectory(normalizedId, messagingAppSdkRoot)) {
      return 'sdkwork-messaging-app-sdk';
    }

    if (sdkCommonRoot && isWithinDirectory(normalizedId, sdkCommonRoot)) {
      return 'sdkwork-sdk-common';
    }

    if (reactVendorPattern.test(normalizedId)) {
      return 'react-vendor';
    }

    if (appRouterPattern.test(normalizedId)) {
      return 'app-router';
    }

    if (appStatePattern.test(normalizedId)) {
      return 'app-state';
    }

    if (appUiPattern.test(normalizedId)) {
      return 'app-ui';
    }

    if (communityEditorPattern.test(normalizedId)) {
      return 'community-editor';
    }

    if (markdownRuntimePattern.test(normalizedId)) {
      return 'markdown-runtime';
    }

    return undefined;
  };
}

export function resolveClawModulePreloadDependencies(
  deps: string[],
  context: { hostType: string },
) {
  if (context.hostType !== 'html') {
    return deps;
  }

  return deps.filter((dependency) => (
    !dependency.includes('community-editor') &&
    !dependency.includes('markdown-runtime')
  ));
}
