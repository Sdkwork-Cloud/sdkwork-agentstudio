import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, CircleUserRound, LogIn, LogOut, Search, Settings2, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { DesktopWindowControls, useAppStore, useAuthStore } from '@sdkwork/claw-core';
import { OPEN_COMMAND_PALETTE_EVENT } from './commandPaletteEvents';

function BrandMark() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 text-white"
      >
        <path d="M12 2v2" />
        <path d="M12 18v4" />
        <path d="M4.93 10.93l1.41 1.41" />
        <path d="M17.66 17.66l1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M4.93 13.07l1.41-1.41" />
        <path d="M17.66 6.34l1.41-1.41" />
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path d="M12 6a6 6 0 0 1 6 6" />
        <path d="M12 18a6 6 0 0 1-6-6" />
      </svg>
    </div>
  );
}

function HeaderActionButton({
  title,
  onClick,
  children,
  className = '',
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      title={title}
      onClick={onClick}
      className={`flex h-9 items-center justify-center rounded-xl bg-zinc-950/[0.04] px-3 text-zinc-600 transition-colors hover:bg-zinc-950/[0.065] hover:text-zinc-950 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.09] dark:hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

export interface AppHeaderProps {
  mode?: 'default' | 'auth';
}

export function AppHeader({ mode = 'default' }: AppHeaderProps) {
  const { t } = useTranslation();
  const openMobileAppDialog = useAppStore((state) => state.openMobileAppDialog);
  const { isAuthenticated, user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthMode = mode === 'auth';
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const accountSettingsTarget = '/settings?tab=account';
  const loginTarget = `/login?redirect=${encodeURIComponent(accountSettingsTarget)}`;

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isUserMenuOpen]);

  const handleUserControlClick = () => {
    if (!isAuthenticated) {
      navigate(loginTarget);
      return;
    }

    setIsUserMenuOpen((open) => !open);
  };

  const handleOpenAccountSettings = () => {
    setIsUserMenuOpen(false);
    navigate(accountSettingsTarget);
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);

    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative z-30 bg-white/72 backdrop-blur-xl dark:bg-zinc-950/78">
      <header className="relative flex h-12 items-center px-3 sm:px-4">
        <div
          data-slot="app-header-leading"
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-none text-zinc-950 dark:text-zinc-50">
                {t('sidebar.brand')}
              </div>
            </div>
          </div>

          {!isAuthMode ? (
            <div
              data-slot="app-header-search"
              data-tauri-drag-region="false"
              className="ml-4"
            >
              <HeaderActionButton
                title={t('commandPalette.searchPlaceholder')}
                onClick={() => {
                  document.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
                }}
                className="gap-2 px-2.5"
              >
                <Search className="h-4 w-4" />
                <span className="hidden text-xs font-medium md:inline">{t('common.search')}</span>
                <span className="hidden rounded-full bg-zinc-950/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400 md:inline">
                  {t('commandPalette.shortcut')}
                </span>
              </HeaderActionButton>
            </div>
          ) : null}
        </div>

        <div
          data-slot="app-header-trailing"
          data-tauri-drag-region="false"
          className="ml-auto flex h-full items-center justify-end gap-2"
        >
          {!isAuthMode ? (
            <>
              <HeaderActionButton
                title={t('install.mobileGuide.headerAction')}
                onClick={openMobileAppDialog}
                className="gap-2 px-2.5"
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden text-xs font-medium lg:inline">
                  {t('install.mobileGuide.headerAction')}
                </span>
              </HeaderActionButton>
              <div ref={userMenuRef} className="relative">
                {isUserMenuOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl bg-white/96 p-2 shadow-[0_14px_32px_rgba(9,9,11,0.14)] backdrop-blur-xl dark:bg-zinc-950/96">
                    <div className="mb-2 rounded-xl bg-zinc-50/90 p-3 dark:bg-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-500/10 text-sm font-bold text-primary-700 dark:text-primary-200">
                          {user?.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            user?.initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                            {user?.displayName}
                          </div>
                          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {user?.email}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAccountSettings}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100/90 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
                    >
                      <Settings2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      <span>{t('sidebar.userMenu.profileSettings')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSignOut();
                      }}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-rose-500 transition-colors hover:bg-rose-500/8 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t('sidebar.userMenu.logout')}</span>
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  data-tauri-drag-region="false"
                  title={isAuthenticated ? t('sidebar.userMenu.open') : t('sidebar.userMenu.login')}
                  onClick={handleUserControlClick}
                  className="group flex h-9 items-center gap-2 rounded-xl bg-zinc-950/[0.04] px-2 text-zinc-600 transition-colors hover:bg-zinc-950/[0.065] hover:text-zinc-950 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.09] dark:hover:text-white"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/92 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    {isAuthenticated && user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : isAuthenticated ? (
                      user?.initials
                    ) : (
                      <CircleUserRound className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    )}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-xs font-medium xl:inline">
                    {isAuthenticated ? user?.displayName : t('sidebar.userMenu.login')}
                  </span>
                  {isAuthenticated ? (
                    <ChevronDown className={`hidden h-4 w-4 text-zinc-400 transition-transform dark:text-zinc-500 xl:inline ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  ) : (
                    <LogIn className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  )}
                </button>
              </div>
            </>
          ) : null}
          <DesktopWindowControls variant="header" />
        </div>
      </header>
    </div>
  );
}
