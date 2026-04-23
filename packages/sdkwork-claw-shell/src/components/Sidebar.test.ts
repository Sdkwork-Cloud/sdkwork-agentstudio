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
      isSidebarCollapsed: true,
      sidebarWidth: 252,
      toggleSidebar: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      setSidebarWidth: vi.fn(),
      hiddenSidebarItems: [] as string[],
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
    'sidebar.workspace': 'Workspace',
    'sidebar.ecosystem': 'Ecosystem',
    'sidebar.setup': 'Setup',
    'sidebar.aiChat': 'AI Chat',
    'sidebar.channels': 'Channels',
    'sidebar.cronTasks': 'Tasks',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.usage': 'Usage',
    'sidebar.agentMarket': 'Agents',
    'sidebar.extensions': 'Extensions',
    'sidebar.clawUpload': 'Networking',
    'sidebar.community': 'Community',
    'sidebar.kernelCenter': 'Kernel',
    'sidebar.nodes': 'Nodes',
    'sidebar.instances': 'Instances',
    'sidebar.documentation': 'Docs',
    'sidebar.account': 'Account',
    'sidebar.userMenu.open': 'Open account menu',
    'sidebar.userMenu.close': 'Close account menu',
    'sidebar.userMenu.login': 'Log in',
    'sidebar.userMenu.guest': 'Guest',
    'sidebar.userMenu.loginHint': 'Sign in to manage your account',
    'common.expandSidebar': 'Expand sidebar',
    'common.collapseSidebar': 'Collapse sidebar',
  } as Record<string, string>,
}));

vi.mock('@sdkwork/claw-core', () => ({
  useAppStore: () => appStoreState.current,
  useAuthStore: () => authStoreState.current,
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

const { Sidebar } = await import('./Sidebar.tsx');

describe('Sidebar', () => {
  beforeEach(() => {
    appStoreState.current = {
      isSidebarCollapsed: true,
      sidebarWidth: 252,
      toggleSidebar: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      setSidebarWidth: vi.fn(),
      hiddenSidebarItems: [],
    };
    authStoreState.current = {
      isAuthenticated: false,
      user: null,
      signOut: vi.fn(async () => undefined),
    };
  });

  it('renders collapsed labels with active emphasis and tighter compact spacing', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).toContain('>AI Chat<');
    expect(markup).toContain('>Networking<');
    expect(markup).toContain('>Docs<');
    expect(markup).toContain('>Guest<');
    expect(markup).toContain('lucide-message-circle h-5 w-5');
    expect(markup).toContain('lucide-circle-question-mark h-5 w-5');
    expect(markup).toContain('lucide-circle-user-round h-5 w-5');
    expect(markup).toContain('min-h-[4rem] w-full max-w-[3.5rem] justify-center');
    expect(markup).toContain('px-1 py-1.5');
    expect(markup).toContain('h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 bg-primary-500 text-primary-50');
    expect(markup).toContain('fill-current stroke-[2.15px] text-primary-50');
    expect(markup).toContain('text-white">AI Chat<');
    expect(markup).toContain('text-zinc-500 group-hover:text-zinc-300">Networking<');
    expect(markup).toContain('transition-all duration-200 mx-auto min-h-[4rem]');
    expect(markup).toContain('rounded-xl');
  });

  it('does not render a leading divider at the top of the collapsed sidebar and keeps only inter-group separators', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    const collapsedDividerMatches = markup.match(/mx-2 my-4 h-px bg-white\/6/g) ?? [];

    expect(collapsedDividerMatches).toHaveLength(1);
    expect(markup).not.toMatch(
      /scrollbar-hide[\s\S]*?<div class="mx-2 my-4 h-px bg-white\/6"><\/div><div class="space-y-1"><a aria-current="page"/,
    );
  });

  it('does not render kernel and nodes entries in the sidebar', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).not.toContain('>Kernel<');
    expect(markup).not.toContain('>Nodes<');
    expect(markup).not.toContain('href="/kernel"');
    expect(markup).not.toContain('href="/nodes"');
  });

  it('moves instances below the main navigation and places it above docs', () => {
    appStoreState.current = {
      ...appStoreState.current,
      isSidebarCollapsed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/instances'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).toContain('>Workspace<');
    expect(markup).toContain('>Ecosystem<');
    expect(markup).toContain('>Instances<');
    expect(markup).toContain('href="/instances"');
    expect(markup).toMatch(/>Workspace<[\s\S]*>Tasks<[\s\S]*>Ecosystem</);
    expect(markup).toMatch(/href="\/instances"[\s\S]*>Instances<[\s\S]*href="\/docs"/);
    expect(markup).not.toContain('>Dashboard<');
    expect(markup).not.toContain('>Usage<');
    expect(markup).not.toContain('href="/dashboard"');
    expect(markup).not.toContain('href="/usage"');
  });

  it('uses a solid primary icon badge for the active expanded item instead of a neutral outlined highlight', () => {
    appStoreState.current = {
      ...appStoreState.current,
      isSidebarCollapsed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).toMatch(
      /h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 bg-primary-500 text-primary-50 shadow-lg shadow-primary-950\/25 ring-1 ring-primary-300\/30/,
    );
    expect(markup).toContain('fill-current stroke-[2.15px] text-primary-50');
    expect(markup).not.toContain('justify-between rounded-2xl px-3 py-2.5 bg-white/[0.08] font-medium text-white');
  });

  it('keeps expanded active labels bright while inactive labels stay subdued', () => {
    appStoreState.current = {
      ...appStoreState.current,
      isSidebarCollapsed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).toContain('text-[14px] tracking-tight text-white">AI Chat<');
    expect(markup).toContain('text-[14px] tracking-tight text-zinc-500 group-hover:text-zinc-300">Channels<');
  });

  it('does not render a top divider above the utility section', () => {
    appStoreState.current = {
      ...appStoreState.current,
      isSidebarCollapsed: false,
    };

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/chat'] },
        createElement(Sidebar),
      ),
    );

    expect(markup).not.toContain('border-t border-white/5');
    expect(markup).toContain('href="/instances"');
    expect(markup).toContain('href="/docs"');
  });
});
