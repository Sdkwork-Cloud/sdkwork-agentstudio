import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ChevronUp,
  CircleUserRound,
  Hash,
  HelpCircle,
  LogIn,
  LogOut,
  MessageCircle,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  type LucideIcon,
  Server,
  Settings2,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useAuthStore } from '@sdkwork/clawstudio-core';
import {
  cancelSidebarRoutePrefetch,
  prefetchSidebarRoute,
  scheduleSidebarRoutePrefetch,
} from '../application/router/routePrefetch';

const COLLAPSED_SIDEBAR_WIDTH = 72;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 360;

interface SidebarNavItem {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
}

interface SidebarNavGroup {
  section: string;
  items: SidebarNavItem[];
}

function getSidebarNavToneClasses(isActive: boolean) {
  if (isActive) {
    return {
      item: 'font-medium',
      iconBadge:
        'bg-primary-600 text-primary-50 shadow-lg shadow-primary-950/18 ring-1 ring-primary-300/40 dark:bg-primary-500 dark:shadow-primary-950/25 dark:ring-primary-300/30',
      icon: 'fill-current stroke-[2.15px] text-primary-50',
      label: 'text-primary-700 dark:text-primary-400',
    };
  }

  return {
    item: '',
    iconBadge: 'bg-transparent group-hover:bg-zinc-950/[0.045] dark:group-hover:bg-white/[0.04]',
    icon: 'text-zinc-500 group-hover:text-zinc-950 dark:text-zinc-500 dark:group-hover:text-zinc-300',
    label: 'text-zinc-600 group-hover:text-zinc-950 dark:text-zinc-500 dark:group-hover:text-zinc-300',
  };
}

function CollapsedSidebarStack({
  label,
  labelClassName,
  children,
}: {
  label: string;
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-center">
      {children}
      <span
        className={`line-clamp-2 max-w-[52px] text-[10px] font-medium leading-[1.15] tracking-tight ${
          labelClassName ?? ''
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function clampSidebarWidth(width: number) {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
}

export function Sidebar() {
  const {
    isSidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    hiddenSidebarItems,
  } = useAppStore();
  const { isAuthenticated, user, signOut } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const accountSettingsTarget = '/settings?tab=account';
  const loginTarget = `/login?redirect=${encodeURIComponent(accountSettingsTarget)}`;

  const resolvedSidebarWidth = clampSidebarWidth(sidebarWidth);

  useEffect(() => {
    if (resolvedSidebarWidth !== sidebarWidth) {
      setSidebarWidth(resolvedSidebarWidth);
    }
  }, [resolvedSidebarWidth, setSidebarWidth, sidebarWidth]);

  useEffect(() => {
    if (!isSidebarResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = clampSidebarWidth(
        resizeStartWidthRef.current + (event.clientX - resizeStartXRef.current),
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsSidebarResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isSidebarResizing, setSidebarWidth]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [isSidebarCollapsed, location.pathname, location.search]);

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

  const startSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const nextWidth = isSidebarCollapsed ? MIN_SIDEBAR_WIDTH : resolvedSidebarWidth;
      resizeStartXRef.current = event.clientX;
      resizeStartWidthRef.current = nextWidth;

      if (isSidebarCollapsed) {
        setSidebarCollapsed(false);
        setSidebarWidth(nextWidth);
      }

      setIsSidebarResizing(true);
    },
    [isSidebarCollapsed, resolvedSidebarWidth, setSidebarCollapsed, setSidebarWidth],
  );

  const navItems: SidebarNavGroup[] = [
    {
      section: t('sidebar.workspace'),
      items: [
        { id: 'chat', to: '/chat', icon: MessageCircle, label: t('sidebar.aiChat') },
        { id: 'channels', to: '/channels', icon: Hash, label: t('sidebar.channels') },
        { id: 'tasks', to: '/tasks', icon: CalendarClock, label: t('sidebar.cronTasks') },
      ],
    },
    {
      section: t('sidebar.ecosystem'),
      items: [
        { id: 'extensions', to: '/extensions', icon: PlugZap, label: t('sidebar.extensions') },
        { id: 'claw-upload', to: '/claw-center', icon: Waypoints, label: t('sidebar.clawUpload') },
        { id: 'community', to: '/community', icon: Newspaper, label: t('sidebar.community') },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hiddenSidebarItems.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0);
  const utilityItems: SidebarNavItem[] = [
    { id: 'instances', to: '/instances', icon: Server, label: t('sidebar.instances') },
    { id: 'docs', to: '/docs', icon: HelpCircle, label: t('sidebar.documentation') },
  ].filter((item) => item.id === 'docs' || !hiddenSidebarItems.includes(item.id));

  const currentSidebarWidth = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : resolvedSidebarWidth;
  const showEdgeAffordances = isSidebarHovered || isSidebarResizing;
  const userMenuTitle = isAuthenticated
    ? isUserMenuOpen
      ? t('sidebar.userMenu.close')
      : t('sidebar.userMenu.open')
    : t('sidebar.userMenu.login');

  const handleUserControlClick = () => {
    if (!isAuthenticated) {
      navigate(loginTarget);
      return;
    }

    setIsUserMenuOpen((open) => !open);
  };

  const handleOpenAccountSettings = () => {
    setIsUserMenuOpen(false);
    prefetchSidebarRoute(accountSettingsTarget);
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
    <div
      className={`relative z-20 flex h-full shrink-0 ${
        isSidebarResizing ? '' : 'transition-[width] duration-200 ease-out'
      }`}
      style={{ width: currentSidebarWidth }}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden border-r border-zinc-200 bg-zinc-50/95 text-zinc-700 shadow-[18px_0_50px_rgba(15,23,42,0.08)] dark:border-zinc-900/90 dark:bg-[linear-gradient(180deg,_#13151a_0%,_#0b0c10_100%)] dark:text-zinc-300 dark:shadow-[18px_0_50px_rgba(9,9,11,0.16)]"
      >
        <nav
          className={`scrollbar-hide flex-1 space-y-5 overflow-x-hidden overflow-y-auto ${
            isSidebarCollapsed ? 'px-2 py-4' : 'px-3 py-5'
          }`}
        >
          {navItems.map((group, groupIndex) => (
            <div key={group.section}>
              {!isSidebarCollapsed ? (
                <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  {group.section}
                </div>
              ) : groupIndex > 0 ? (
                <div className="mx-2 my-4 h-px bg-zinc-200/80 dark:bg-white/6" />
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={isSidebarCollapsed ? item.label : undefined}
                    onPointerDown={() => prefetchSidebarRoute(item.to)}
                    onMouseEnter={() => scheduleSidebarRoutePrefetch(item.to)}
                    onMouseLeave={() => cancelSidebarRoutePrefetch(item.to)}
                    onFocus={() => scheduleSidebarRoutePrefetch(item.to)}
                    onBlur={() => cancelSidebarRoutePrefetch(item.to)}
                    className={({ isActive }) => {
                      const tone = getSidebarNavToneClasses(isActive);

                      return `group relative flex items-center transition-all duration-200 ${
                        isSidebarCollapsed
                          ? 'mx-auto min-h-[4rem] w-full max-w-[3.5rem] justify-center rounded-xl px-1 py-1.5'
                          : 'justify-between rounded-2xl px-3 py-2.5'
                      } hover:bg-zinc-950/[0.045] dark:hover:bg-white/[0.05] ${tone.item}`;
                    }}
                  >
                    {({ isActive }) => {
                      const tone = getSidebarNavToneClasses(isActive);

                      return (
                        <>
                          {isActive && !isSidebarCollapsed ? (
                            <motion.div
                              layoutId="sidebar-active-indicator"
                              className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                            />
                          ) : null}
                          {isSidebarCollapsed ? (
                            <CollapsedSidebarStack label={item.label} labelClassName={tone.label}>
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${tone.iconBadge}`}
                              >
                                <item.icon
                                  className={`h-5 w-5 shrink-0 transition-colors ${tone.icon}`}
                                />
                              </div>
                            </CollapsedSidebarStack>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${tone.iconBadge}`}
                              >
                                <item.icon className={`h-4 w-4 shrink-0 transition-colors ${tone.icon}`} />
                              </div>
                              <span className={`text-[14px] tracking-tight ${tone.label}`}>
                                {item.label}
                              </span>
                            </div>
                          )}
                          {!isSidebarCollapsed && item.badge ? (
                            <span className="rounded-full border border-primary-500/25 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/15 dark:text-primary-300">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      );
                    }}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 p-3">
          {utilityItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              title={isSidebarCollapsed ? item.label : undefined}
              onPointerDown={() => prefetchSidebarRoute(item.to)}
              onMouseEnter={() => scheduleSidebarRoutePrefetch(item.to)}
              onMouseLeave={() => cancelSidebarRoutePrefetch(item.to)}
              onFocus={() => scheduleSidebarRoutePrefetch(item.to)}
              onBlur={() => cancelSidebarRoutePrefetch(item.to)}
              className={({ isActive }) => {
                const tone = getSidebarNavToneClasses(isActive);

                return `group relative flex items-center transition-all duration-200 ${
                  isSidebarCollapsed
                    ? 'mx-auto min-h-[4rem] w-full max-w-[3.5rem] justify-center rounded-xl px-1 py-1.5'
                    : 'gap-3 rounded-2xl px-3 py-2.5'
                } hover:bg-zinc-950/[0.045] dark:hover:bg-white/[0.05] ${tone.item}`;
              }}
            >
              {({ isActive }) => {
                const tone = getSidebarNavToneClasses(isActive);

                return (
                  <>
                    {isActive && !isSidebarCollapsed ? (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                      />
                    ) : null}
                    {isSidebarCollapsed ? (
                      <CollapsedSidebarStack label={item.label} labelClassName={tone.label}>
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${tone.iconBadge}`}
                        >
                          <item.icon
                            className={`h-5 w-5 shrink-0 transition-colors ${tone.icon}`}
                          />
                        </div>
                      </CollapsedSidebarStack>
                    ) : (
                      <>
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${tone.iconBadge}`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 transition-colors ${tone.icon}`} />
                        </div>
                        <span className={`text-[14px] tracking-tight ${tone.label}`}>
                          {item.label}
                        </span>
                      </>
                    )}
                  </>
                );
              }}
            </NavLink>
          ))}
          <div ref={userMenuRef} className="relative">
            {isUserMenuOpen ? (
              <div
                className={`absolute z-40 rounded-[20px] border border-zinc-200 bg-white/96 p-2 shadow-[0_20px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/96 dark:shadow-[0_20px_48px_rgba(9,9,11,0.34)] ${
                  isSidebarCollapsed ? 'bottom-0 left-full ml-3 w-64' : 'bottom-full left-0 right-0 mb-2'
                }`}
              >
                <div className="mb-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/8 dark:bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-50 text-sm font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
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
                      <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                        {user?.displayName}
                      </div>
                      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user?.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {t('sidebar.userMenu.signedIn')}
                  </div>
                </div>

                <button
                  type="button"
                  onPointerDown={() => prefetchSidebarRoute(accountSettingsTarget)}
                  onMouseEnter={() => scheduleSidebarRoutePrefetch(accountSettingsTarget)}
                  onMouseLeave={() => cancelSidebarRoutePrefetch(accountSettingsTarget)}
                  onFocus={() => scheduleSidebarRoutePrefetch(accountSettingsTarget)}
                  onBlur={() => cancelSidebarRoutePrefetch(accountSettingsTarget)}
                  onClick={handleOpenAccountSettings}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <Settings2 className="h-4 w-4 text-zinc-500" />
                  <span>{t('sidebar.userMenu.profileSettings')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-800 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('sidebar.userMenu.logout')}</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              data-slot="sidebar-user-control"
              title={isSidebarCollapsed ? userMenuTitle : undefined}
              onClick={handleUserControlClick}
              className={`group relative flex w-full items-center border border-zinc-200 bg-white text-zinc-700 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-950 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white ${
                isSidebarCollapsed
                  ? 'mx-auto min-h-[4.75rem] max-w-[3.5rem] justify-center rounded-xl px-1 py-2'
                  : 'gap-3 rounded-2xl px-2.5 py-2.5'
              }`}
            >
              {isSidebarCollapsed ? (
                <CollapsedSidebarStack
                  label={isAuthenticated ? user?.displayName || t('sidebar.account') : t('sidebar.userMenu.guest')}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-white/[0.08] dark:text-white">
                    {isAuthenticated && user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : isAuthenticated ? (
                      user?.initials
                    ) : (
                      <CircleUserRound className="h-5 w-5 text-zinc-500 dark:text-zinc-300" />
                    )}
                  </div>
                </CollapsedSidebarStack>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-white/[0.08] dark:text-white">
                  {isAuthenticated && user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : isAuthenticated ? (
                    user?.initials
                  ) : (
                    <CircleUserRound className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                  )}
                </div>
              )}

              {!isSidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                      {isAuthenticated ? user?.displayName : t('sidebar.userMenu.guest')}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {isAuthenticated ? user?.email : t('sidebar.userMenu.loginHint')}
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <ChevronUp
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                        isUserMenuOpen ? '' : 'rotate-180'
                      }`}
                    />
                  ) : (
                    <LogIn className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300" />
                  )}
                </>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        data-slot="sidebar-edge-control"
        title={isSidebarCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        onClick={toggleSidebar}
        className={`absolute right-0 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition-all duration-200 dark:border-white/8 dark:bg-zinc-950 dark:text-zinc-200 dark:shadow-[0_10px_24px_rgba(9,9,11,0.26)] ${
          showEdgeAffordances
            ? 'opacity-100 hover:scale-105 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            : 'pointer-events-none opacity-0'
        }`}
      >
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>

      <div
        data-slot="sidebar-resize-handle"
        onPointerDown={startSidebarResize}
        className="absolute inset-y-0 right-0 z-20 w-3 cursor-col-resize touch-none"
      />
    </div>
  );
}
