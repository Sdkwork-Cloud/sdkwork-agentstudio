import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Globe,
  Hash,
  HelpCircle,
  type LucideIcon,
  MessageCircle,
  PanelLeftClose,
  Puzzle,
  Server,
  Settings,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  instanceDirectoryService,
  resolvePreferredActiveInstanceId,
} from '../services/index.ts';
import { useAppStore } from '../stores/useAppStore.ts';
import { useInstanceStore } from '../stores/useInstanceStore.ts';

interface InstanceSummary {
  id: string;
  name: string;
  ip: string;
  status: string;
}

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

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, hiddenSidebarItems } = useAppStore();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    let disposed = false;

    const syncInstances = (nextInstances: InstanceSummary[]) => {
      if (disposed) {
        return;
      }

      setInstances(nextInstances);
    };

    async function fetchInstances() {
      try {
        syncInstances(await instanceDirectoryService.listInstances());
      } catch (error) {
        console.error('Failed to fetch instances for sidebar:', error);
      }
    }

    const unsubscribe = instanceDirectoryService.subscribe(syncInstances);
    void fetchInstances();

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const nextActiveInstanceId = resolvePreferredActiveInstanceId({
      instances,
      activeInstanceId,
    });
    if (nextActiveInstanceId !== activeInstanceId) {
      setActiveInstanceId(nextActiveInstanceId);
    }
  }, [activeInstanceId, instances, setActiveInstanceId]);

  const activeInstance = instances.find((instance) => instance.id === activeInstanceId);

  const navItems: SidebarNavGroup[] = [
    {
      section: t('sidebar.workspace'),
      items: [
        { id: 'chat', to: '/chat', icon: MessageCircle, label: t('sidebar.aiChat') },
        { id: 'channels', to: '/channels', icon: Hash, label: t('sidebar.channels') },
        { id: 'tasks', to: '/tasks', icon: Clock, label: t('sidebar.cronTasks') },
      ],
    },
    {
      section: t('sidebar.ecosystem'),
      items: [
        { id: 'extensions', to: '/extensions', icon: Puzzle, label: t('sidebar.extensions') },
        { id: 'claw-upload', to: '/claw-center', icon: Globe, label: t('sidebar.clawUpload') },
        { id: 'community', to: '/community', icon: Users, label: t('sidebar.community') },
      ],
    },
    {
      section: t('sidebar.setup'),
      items: [
        { id: 'instances', to: '/instances', icon: Server, label: t('sidebar.instances') },
        { id: 'devices', to: '/devices', icon: Cpu, label: t('sidebar.devices') },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hiddenSidebarItems.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <motion.div
      initial={false}
      animate={{ width: isSidebarCollapsed ? 60 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      className="relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-zinc-900 bg-zinc-950 text-zinc-300"
    >
      <div className={`relative flex flex-col pb-4 pt-6 ${isSidebarCollapsed ? 'items-center' : 'px-5'}`}>
        <div className={`flex w-full items-center overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            onClick={isSidebarCollapsed ? toggleSidebar : undefined}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 shadow-lg shadow-primary-900/20 ${isSidebarCollapsed ? 'cursor-pointer transition-colors hover:bg-primary-500' : ''}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-white"
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
          {!isSidebarCollapsed ? (
            <span className="text-xl font-bold tracking-tight text-white">{t('sidebar.brand')}</span>
          ) : null}

          {!isSidebarCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="absolute right-4 top-6 rounded-md p-1 text-zinc-500 transition-opacity hover:bg-zinc-800 hover:text-white"
              title={t('common.collapseSidebar')}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className={`relative mt-6 ${isSidebarCollapsed ? 'flex w-full justify-center' : ''}`}>
          <button
            onClick={() => setIsInstanceDropdownOpen((open) => !open)}
            className={
              isSidebarCollapsed
                ? 'group relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 transition-colors hover:bg-zinc-800'
                : 'flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 transition-colors hover:bg-zinc-800'
            }
            title={isSidebarCollapsed ? activeInstance?.name || t('sidebar.selectInstance') : undefined}
          >
            {isSidebarCollapsed ? (
              <>
                <Server className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-zinc-200" />
                <div
                  className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-zinc-950 ${
                    activeInstance?.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'
                  }`}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      activeInstance?.status === 'online'
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                        : 'bg-zinc-500'
                    }`}
                  />
                  <span className="truncate text-sm font-medium text-zinc-200">
                    {activeInstance ? activeInstance.name : t('sidebar.selectInstance')}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-500 transition-transform ${
                    isInstanceDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            )}
          </button>

          <AnimatePresence>
            {isInstanceDropdownOpen ? (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsInstanceDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: isSidebarCollapsed ? 0 : -10, x: isSidebarCollapsed ? -10 : 0, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                  exit={{ opacity: 0, y: isSidebarCollapsed ? 0 : -10, x: isSidebarCollapsed ? -10 : 0, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={`absolute z-40 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl ${
                    isSidebarCollapsed ? 'left-full top-0 ml-4 w-64' : 'left-0 right-0 top-full mt-2'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950/30 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {t('sidebar.switchInstance')}
                    </span>
                    <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-600">
                      {instances.length}
                    </span>
                  </div>
                  <div className="scrollbar-hide max-h-60 overflow-y-auto py-1">
                    {instances.map((instance) => (
                      <button
                        key={instance.id}
                        onClick={() => {
                          setActiveInstanceId(instance.id);
                          setIsInstanceDropdownOpen(false);
                        }}
                        className="group flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-zinc-800/80"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              instance.status === 'online'
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                : 'bg-zinc-500'
                            }`}
                          />
                          <div className="flex flex-col items-start truncate">
                            <span
                              className={`truncate text-sm ${
                                activeInstanceId === instance.id
                                  ? 'font-medium text-white'
                                  : 'text-zinc-300 transition-colors group-hover:text-white'
                              }`}
                            >
                              {instance.name}
                            </span>
                            <span className="truncate font-mono text-[10px] text-zinc-500">
                              {instance.ip}
                            </span>
                          </div>
                        </div>
                        {activeInstanceId === instance.id ? <Check className="h-4 w-4 shrink-0 text-primary-500" /> : null}
                      </button>
                    ))}
                    {instances.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-3 py-6 text-center">
                        <Server className="mb-2 h-8 w-8 text-zinc-700" />
                        <span className="text-sm text-zinc-400">{t('sidebar.noInstances')}</span>
                        <span className="mt-1 text-xs text-zinc-500">{t('sidebar.addOne')}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-2">
                    <button
                      onClick={() => {
                        setIsInstanceDropdownOpen(false);
                        navigate('/instances');
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {t('sidebar.manageInstances')}
                    </button>
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <nav className={`scrollbar-hide mt-4 flex-1 space-y-6 overflow-x-hidden overflow-y-auto ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((group) => (
          <div key={group.section}>
            {!isSidebarCollapsed ? (
              <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {group.section}
              </div>
            ) : (
              <div className="mx-2 my-4 h-px bg-zinc-800/50" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-xl transition-all duration-200 ${
                      isSidebarCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'justify-between px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-primary-500/10 font-medium text-primary-400'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !isSidebarCollapsed ? (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                        />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'
                          }`}
                        />
                        {!isSidebarCollapsed ? <span className="text-[14px] tracking-tight">{item.label}</span> : null}
                      </div>
                      {!isSidebarCollapsed && item.badge ? (
                        <span className="rounded border border-primary-500/20 bg-primary-500/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-400">
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-zinc-900 p-4">
        <NavLink
          to="/docs"
          title={isSidebarCollapsed ? t('sidebar.documentation') : undefined}
          className={({ isActive }) =>
            `group relative flex items-center rounded-xl transition-all duration-200 ${
              isSidebarCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'gap-3 px-3 py-2.5'
            } ${
              isActive
                ? 'bg-primary-500/10 font-medium text-primary-400'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && !isSidebarCollapsed ? (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                />
              ) : null}
              <HelpCircle
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              {!isSidebarCollapsed ? (
                <span className="text-[14px] tracking-tight">{t('sidebar.documentation')}</span>
              ) : null}
            </>
          )}
        </NavLink>
        <NavLink
          to="/settings"
          title={isSidebarCollapsed ? t('sidebar.settings') : undefined}
          className={({ isActive }) =>
            `group relative flex items-center rounded-xl transition-all duration-200 ${
              isSidebarCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'gap-3 px-3 py-2.5'
            } ${
              isActive
                ? 'bg-primary-500/10 font-medium text-primary-400'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && !isSidebarCollapsed ? (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-500"
                />
              ) : null}
              <Settings
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? 'text-primary-400' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              {!isSidebarCollapsed ? (
                <span className="flex-1 text-[14px] tracking-tight">{t('sidebar.settings')}</span>
              ) : null}
            </>
          )}
        </NavLink>
      </div>
    </motion.div>
  );
}
