export type SdkworkUserAppearancePreset =
  | 'standard'
  | 'midnight'
  | 'paper'
  | (string & {});

export interface SdkworkUserThemeTokens {
  [key: string]: string | undefined;
}

export interface SdkworkUserAppearanceConfig {
  [key: string]: unknown;
  preset?: SdkworkUserAppearancePreset;
  theme?: SdkworkUserThemeTokens;
}

function cloneTheme(
  theme?: SdkworkUserThemeTokens | null,
): SdkworkUserThemeTokens | undefined {
  if (!theme) {
    return undefined;
  }

  return { ...theme };
}

export function createSdkworkUserAppearancePreset(
  preset?: SdkworkUserAppearancePreset,
  theme?: SdkworkUserThemeTokens,
): SdkworkUserAppearanceConfig {
  return {
    ...(preset ? { preset } : {}),
    ...(theme ? { theme: cloneTheme(theme) } : {}),
  };
}

export function mergeSdkworkUserAppearanceConfigs(
  ...configs: Array<SdkworkUserAppearanceConfig | null | undefined>
): SdkworkUserAppearanceConfig {
  let mergedTheme: SdkworkUserThemeTokens | undefined;
  const merged: SdkworkUserAppearanceConfig = {};

  for (const config of configs) {
    if (!config) {
      continue;
    }

    Object.assign(merged, config);
    if (config.theme) {
      mergedTheme = {
        ...(mergedTheme || {}),
        ...config.theme,
      };
    }
  }

  return {
    ...merged,
    ...(mergedTheme ? { theme: mergedTheme } : {}),
  };
}

export function resolveSdkworkUserAppearance(
  config?: SdkworkUserAppearanceConfig | null,
): SdkworkUserAppearanceConfig {
  return mergeSdkworkUserAppearanceConfigs(config || {});
}
