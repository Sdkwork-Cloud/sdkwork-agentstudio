export type SdkworkAuthAppearancePreset =
  | 'claw'
  | 'midnight'
  | 'paper'
  | (string & {});

export interface SdkworkAuthThemeTokens {
  [key: string]: string | undefined;
}

export interface SdkworkAuthAppearanceConfig {
  [key: string]: unknown;
  preset?: SdkworkAuthAppearancePreset;
  theme?: SdkworkAuthThemeTokens;
}

function cloneTheme(
  theme?: SdkworkAuthThemeTokens | null,
): SdkworkAuthThemeTokens | undefined {
  if (!theme) {
    return undefined;
  }

  return { ...theme };
}

export function createSdkworkAuthAppearancePreset(
  preset?: SdkworkAuthAppearancePreset,
  theme?: SdkworkAuthThemeTokens,
): SdkworkAuthAppearanceConfig {
  return {
    ...(preset ? { preset } : {}),
    ...(theme ? { theme: cloneTheme(theme) } : {}),
  };
}

export function mergeSdkworkAuthAppearanceConfigs(
  ...configs: Array<SdkworkAuthAppearanceConfig | null | undefined>
): SdkworkAuthAppearanceConfig {
  let mergedTheme: SdkworkAuthThemeTokens | undefined;
  const merged: SdkworkAuthAppearanceConfig = {};

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

export function resolveSdkworkAuthAppearance(
  config?: SdkworkAuthAppearanceConfig | null,
): SdkworkAuthAppearanceConfig {
  return mergeSdkworkAuthAppearanceConfigs(config || {});
}
