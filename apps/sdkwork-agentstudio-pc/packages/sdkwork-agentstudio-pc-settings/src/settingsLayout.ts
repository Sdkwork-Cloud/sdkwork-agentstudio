const WIDE_CONTENT_TAB_IDS = new Set([
  'general',
  'api',
  'billing',
  'wallet',
  'account',
  'notifications',
  'feedback',
  'security',
  'data',
]);

export function isSettingsWideContentTab(tabId: string | null | undefined) {
  return Boolean(tabId && WIDE_CONTENT_TAB_IDS.has(tabId));
}

export function resolveSettingsContentShellClassName(tabId: string | null | undefined) {
  return isSettingsWideContentTab(tabId)
    ? 'w-full max-w-none px-4 py-4 md:px-6 md:py-6 xl:px-8 xl:py-8'
    : 'mx-auto w-full max-w-5xl p-8 md:p-12';
}
