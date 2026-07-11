import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Server, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  instanceDirectoryService,
  resolvePreferredActiveInstanceId,
  useInstanceStore,
  type InstanceDirectoryItem,
} from '@sdkwork/agentstudio-pc-core';

export function InstanceSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [instances, setInstances] = useState<InstanceDirectoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let disposed = false;

    const syncInstances = (nextInstances: InstanceDirectoryItem[]) => {
      if (disposed) {
        return;
      }

      setInstances(nextInstances);
    };

    async function fetchInstances() {
      try {
        syncInstances(await instanceDirectoryService.listInstances());
      } catch (error) {
        console.error('Failed to fetch instances for header switcher:', error);
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

  const activeInstance =
    instances.find((instance) => instance.id === activeInstanceId) ?? instances[0] ?? null;

  return (
    <div className="relative w-full">
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 w-full items-center justify-between rounded-2xl bg-zinc-950/[0.045] px-3 text-left transition-colors hover:bg-zinc-950/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              activeInstance?.status === 'online'
                ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                : 'bg-zinc-500'
            }`}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-100">
              {activeInstance ? activeInstance.name : t('sidebar.selectInstance')}
            </div>
            <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
              {activeInstance ? activeInstance.ip : t('sidebar.manageInstances')}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute left-1/2 top-full z-40 mt-2 w-[30rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-white/96 shadow-[0_22px_70px_rgba(15,23,42,0.18)] backdrop-blur dark:bg-zinc-900/96"
            >
              <div className="flex items-center justify-between bg-zinc-50/80 px-4 py-3 dark:bg-zinc-950/50">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {t('sidebar.switchInstance')}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400">
                  {instances.length}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto py-2 scrollbar-hide">
                {instances.map((instance) => (
                  <button
                    key={instance.id}
                    type="button"
                    data-tauri-drag-region="false"
                    onClick={() => {
                      setActiveInstanceId(instance.id);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          instance.status === 'online'
                            ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                            : 'bg-zinc-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm ${
                            activeInstanceId === instance.id
                              ? 'font-semibold text-zinc-950 dark:text-white'
                              : 'text-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          {instance.name}
                        </div>
                        <div className="truncate text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {instance.ip}
                        </div>
                      </div>
                    </div>
                    {activeInstanceId === instance.id ? (
                      <Check className="h-4 w-4 shrink-0 text-primary-500" />
                    ) : null}
                  </button>
                ))}

                {instances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <Server className="mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('sidebar.noInstances')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      {t('sidebar.addOne')}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="bg-zinc-50/70 p-2 dark:bg-zinc-950/50">
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/instances');
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Settings className="h-4 w-4" />
                  {t('sidebar.manageInstances')}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
