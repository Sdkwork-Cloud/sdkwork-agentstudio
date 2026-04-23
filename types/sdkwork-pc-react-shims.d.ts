declare module '@sdkwork/auth-pc-react' {
  export type SdkworkAuthAppearancePreset = 'claw' | 'midnight' | 'paper' | (string & {});

  export interface SdkworkAuthThemeTokens {
    [key: string]: string | undefined;
    asideCardBackgroundColor?: string;
    asideCardBorderColor?: string;
    asideIconWellBackgroundColor?: string;
    asideIconWellColor?: string;
    asidePanelBackgroundColor?: string;
    asidePanelBorderColor?: string;
    asidePanelColor?: string;
    badgeBackgroundColor?: string;
    badgeTextColor?: string;
    callbackBackgroundColor?: string;
    callbackTextColor?: string;
    descriptionColor?: string;
    oauthProviderCardBackgroundColor?: string;
    oauthProviderCardBorderColor?: string;
    pageBackgroundColor?: string;
    qrFrameBackgroundColor?: string;
    qrFrameBorderColor?: string;
    shellBackgroundColor?: string;
    shellBorderColor?: string;
    titleColor?: string;
  }

  export interface SdkworkAuthAppearanceConfig {
    [key: string]: unknown;
    preset?: SdkworkAuthAppearancePreset;
    theme?: SdkworkAuthThemeTokens;
  }

  export function createSdkworkAuthAppearancePreset(
    preset?: SdkworkAuthAppearancePreset,
    theme?: SdkworkAuthThemeTokens,
  ): SdkworkAuthAppearanceConfig;

  export function mergeSdkworkAuthAppearanceConfigs(
    ...configs: Array<SdkworkAuthAppearanceConfig | null | undefined>
  ): SdkworkAuthAppearanceConfig;

  export function resolveSdkworkAuthAppearance(
    config?: SdkworkAuthAppearanceConfig | null,
  ): SdkworkAuthAppearanceConfig;
}

declare module '@sdkwork/user-pc-react' {
  export type SdkworkUserAppearancePreset = 'standard' | 'midnight' | 'paper' | (string & {});

  export interface SdkworkUserThemeTokens {
    [key: string]: string | undefined;
    contentBackgroundColor?: string;
    heroBadgeBackgroundColor?: string;
    heroBadgeTextColor?: string;
    heroDescriptionColor?: string;
    heroIconBackgroundColor?: string;
    heroIconColor?: string;
    heroPanelBackgroundColor?: string;
    heroPanelBorderColor?: string;
    heroTitleColor?: string;
    pageBackgroundColor?: string;
    sectionSurfaceBackgroundColor?: string;
    sectionSurfaceBorderColor?: string;
    shellBackgroundColor?: string;
    shellBorderColor?: string;
    shellShadow?: string;
    standardsCardBackgroundColor?: string;
    standardsCardBorderColor?: string;
    standardsIconBackgroundColor?: string;
    standardsIconColor?: string;
    standardsPanelBackgroundColor?: string;
    standardsPanelBorderColor?: string;
    standardsPanelColor?: string;
  }

  export interface SdkworkUserAppearanceConfig {
    [key: string]: unknown;
    preset?: SdkworkUserAppearancePreset;
    theme?: SdkworkUserThemeTokens;
  }

  export function createSdkworkUserAppearancePreset(
    preset?: SdkworkUserAppearancePreset,
    theme?: SdkworkUserThemeTokens,
  ): SdkworkUserAppearanceConfig;

  export function mergeSdkworkUserAppearanceConfigs(
    ...configs: Array<SdkworkUserAppearanceConfig | null | undefined>
  ): SdkworkUserAppearanceConfig;

  export function resolveSdkworkUserAppearance(
    config?: SdkworkUserAppearanceConfig | null,
  ): SdkworkUserAppearanceConfig;
}
