import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultLanguage,
  normalizeLanguage,
  resolveInitialLanguage,
  type SupportedLanguage,
} from '@sdkwork/agentstudio-pc-i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'lobster' | 'tech-blue' | 'green-tech' | 'zinc' | 'violet' | 'rose';
export type Language = SupportedLanguage;
export type LanguagePreference = Language | 'system';

interface AppState {
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  sidebarVisibilityVersion: number;
  hiddenSidebarItems: string[];
  toggleSidebarItem: (id: string) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  language: Language;
  languagePreference: LanguagePreference;
  hasExplicitLanguagePreference: boolean;
  setLanguage: (lang: LanguagePreference) => void;
  isMobileAppDialogOpen: boolean;
  hasSeenMobileAppPrompt: boolean;
  openMobileAppDialog: () => void;
  closeMobileAppDialog: () => void;
  markMobileAppPromptSeen: () => void;
}

type PersistedAppState = Pick<
  AppState,
  | 'isSidebarCollapsed'
  | 'sidebarWidth'
  | 'sidebarVisibilityVersion'
  | 'hiddenSidebarItems'
  | 'themeMode'
  | 'themeColor'
  | 'language'
  | 'languagePreference'
  | 'hasExplicitLanguagePreference'
  | 'hasSeenMobileAppPrompt'
>;

const SIDEBAR_VISIBILITY_VERSION = 5;
const DEFAULT_HIDDEN_SIDEBAR_ITEMS = ['extensions'] as const;

function dedupeSidebarItems(items: readonly string[]) {
  return Array.from(new Set(items));
}

function migrateHiddenSidebarItems(hiddenSidebarItems?: string[]) {
  return dedupeSidebarItems([
    ...(hiddenSidebarItems || []).filter(
      (item) =>
        item !== 'apps'
        && item !== 'market'
        && item !== 'mall'
        && item !== 'github'
        && item !== 'huggingface'
        && item !== 'model-purchase'
        && item !== 'points'
        && item !== 'install',
    ),
    ...DEFAULT_HIDDEN_SIDEBAR_ITEMS,
  ]);
}

const getDefaultLanguage = (): Language => {
  return resolveInitialLanguage();
};

const normalizeLanguagePreference = (value?: string | null): LanguagePreference => {
  if (value === 'system') {
    return 'system';
  }

  return normalizeLanguage(value);
};

const resolveLanguageFromPreference = (preference: LanguagePreference): Language => {
  if (preference === 'system') {
    return getDefaultLanguage();
  }

  return normalizeLanguage(preference);
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      sidebarWidth: 252,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      sidebarVisibilityVersion: SIDEBAR_VISIBILITY_VERSION,
      hiddenSidebarItems: [...DEFAULT_HIDDEN_SIDEBAR_ITEMS],
      toggleSidebarItem: (id) =>
        set((state) => ({
          hiddenSidebarItems: state.hiddenSidebarItems.includes(id)
            ? state.hiddenSidebarItems.filter((itemId) => itemId !== id)
            : [...state.hiddenSidebarItems, id],
        })),
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      themeColor: 'tech-blue',
      setThemeColor: (themeColor) => set({ themeColor }),
      languagePreference: 'system',
      hasExplicitLanguagePreference: false,
      language: getDefaultLanguage(),
      setLanguage: (languagePreference) => {
        const nextLanguagePreference = normalizeLanguagePreference(languagePreference);
        set({
          languagePreference: nextLanguagePreference,
          hasExplicitLanguagePreference: true,
          language: resolveLanguageFromPreference(nextLanguagePreference),
        });
      },
      isMobileAppDialogOpen: false,
      hasSeenMobileAppPrompt: false,
      openMobileAppDialog: () => set({ isMobileAppDialogOpen: true }),
      closeMobileAppDialog: () => set({ isMobileAppDialogOpen: false }),
      markMobileAppPromptSeen: () => set({ hasSeenMobileAppPrompt: true }),
    }),
    {
      name: 'agent-studio-app-storage',
      partialize: (state): PersistedAppState => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        sidebarVisibilityVersion: state.sidebarVisibilityVersion,
        hiddenSidebarItems: state.hiddenSidebarItems,
        themeMode: state.themeMode,
        themeColor: state.themeColor,
        language: state.language,
        languagePreference: state.languagePreference,
        hasExplicitLanguagePreference: state.hasExplicitLanguagePreference,
        hasSeenMobileAppPrompt: state.hasSeenMobileAppPrompt,
      }),
      merge: (persistedState, currentState) => {
        const nextState = (persistedState as Partial<PersistedAppState>) || {};
        const persistedLanguagePreference = normalizeLanguagePreference(
          nextState.languagePreference ?? 'system',
        );
        const hasExplicitLanguagePreference =
          nextState.hasExplicitLanguagePreference === true ||
          (nextState.hasExplicitLanguagePreference == null &&
            persistedLanguagePreference !== defaultLanguage);
        const languagePreference = hasExplicitLanguagePreference
          ? persistedLanguagePreference
          : 'system';
        const hiddenSidebarItems =
          nextState.sidebarVisibilityVersion === SIDEBAR_VISIBILITY_VERSION
            ? dedupeSidebarItems(nextState.hiddenSidebarItems ?? currentState.hiddenSidebarItems)
            : migrateHiddenSidebarItems(nextState.hiddenSidebarItems);

        return {
          ...currentState,
          ...nextState,
          sidebarVisibilityVersion: SIDEBAR_VISIBILITY_VERSION,
          hiddenSidebarItems,
          hasExplicitLanguagePreference,
          languagePreference,
          language: resolveLanguageFromPreference(languagePreference ?? defaultLanguage),
          isMobileAppDialogOpen: false,
          hasSeenMobileAppPrompt:
            nextState.hasSeenMobileAppPrompt ?? currentState.hasSeenMobileAppPrompt ?? false,
        };
      },
    },
  ),
);
