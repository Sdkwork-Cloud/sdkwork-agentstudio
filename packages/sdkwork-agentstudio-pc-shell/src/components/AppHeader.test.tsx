import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  appStoreState,
  authStoreState,
  translations,
} = vi.hoisted(() => ({
  appStoreState: {
    current: {
      openMobileAppDialog: vi.fn(),
    },
  },
  authStoreState: {
    current: {
      isAuthenticated: false,
      user: null,
      signOut: vi.fn(async () => undefined),
    },
  },
  translations: {
    'sidebar.brand': 'Agent Studio',
    'sidebar.workspace': 'Workspace',
    'sidebar.userMenu.login': 'Log in',
    'sidebar.userMenu.open': 'Open account menu',
    'commandPalette.searchPlaceholder': 'Search',
    'commandPalette.shortcut': 'Ctrl+K',
    'common.search': 'Search',
    'install.mobileGuide.headerAction': 'Mobile',
  } as Record<string, string>,
}));

vi.mock('@sdkwork/agentstudio-pc-core', () => ({
  DesktopWindowControls: () => createElement('div', { 'data-slot': 'desktop-window-controls' }),
  useAppStore: (selector?: (state: typeof appStoreState.current) => unknown) =>
    selector ? selector(appStoreState.current) : appStoreState.current,
  useAuthStore: (selector?: (state: typeof authStoreState.current) => unknown) =>
    selector ? selector(authStoreState.current) : authStoreState.current,
}));

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => translations[key] ?? key,
    }),
  };
});

const { AppHeader } = await import('./AppHeader.tsx');

describe('AppHeader', () => {
  beforeEach(() => {
    appStoreState.current = {
      openMobileAppDialog: vi.fn(),
    };
    authStoreState.current = {
      isAuthenticated: false,
      user: null,
      signOut: vi.fn(async () => undefined),
    };
  });

  it('keeps the brand and search actions while removing the centered workspace and instance switcher area', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(AppHeader),
      ),
    );

    expect(markup).toContain('data-slot="app-header-leading"');
    expect(markup).toContain('data-slot="app-header-search"');
    expect(markup).toContain('Agent Studio');
    expect(markup).not.toContain('data-slot="app-header-center"');
    expect(markup).not.toContain('data-slot="app-header-workspace"');
    expect(markup).not.toContain('>Workspace<');
  });

  it('can render only the shared desktop window controls without workspace chrome', () => {
    const markup = renderToStaticMarkup(
      createElement(AppHeader, { mode: 'window-controls' }),
    );

    expect(markup).toContain('data-slot="desktop-window-controls"');
    expect(markup).toContain('data-slot="app-header-trailing"');
    expect(markup).not.toContain('data-slot="app-header-leading"');
    expect(markup).not.toContain('data-slot="app-header-search"');
    expect(markup).not.toContain('Agent Studio');
    expect(markup).not.toContain('Mobile');
    expect(markup).not.toContain('Log in');
  });
});
