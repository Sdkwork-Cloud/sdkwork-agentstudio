export type ApiSettingsSection = 'providers' | 'requests' | 'messages';

export function resolveApiSettingsSection(
  value: string | null | undefined,
  legacyLogsTab?: string | null | undefined,
): ApiSettingsSection {
  if (value === 'requests' || value === 'messages') {
    return value;
  }

  // Keep old deep links working while the UI moves from stacked tabs to a single top-level tab row.
  if (value === 'logs') {
    return legacyLogsTab === 'messages' ? 'messages' : 'requests';
  }

  return 'providers';
}
