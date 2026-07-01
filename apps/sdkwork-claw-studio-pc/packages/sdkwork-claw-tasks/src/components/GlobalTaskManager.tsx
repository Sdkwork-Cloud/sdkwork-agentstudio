import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  HardDriveDownload,
  Loader2,
  Package,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { type GlobalTask, useTaskStore } from '@sdkwork/claw-core';

function TaskIcon({
  type,
  status,
}: {
  type: GlobalTask['type'];
  status: GlobalTask['status'];
}) {
  if (status === 'success') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  }

  if (status === 'error') {
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  }

  switch (type) {
    case 'download':
      return <HardDriveDownload className="h-5 w-5 text-primary-500" />;
    case 'install':
      return <Package className="h-5 w-5 text-amber-500" />;
    case 'build':
      return <Terminal className="h-5 w-5 text-purple-500" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />;
  }
}

export function GlobalTaskManager() {
  const { tasks, isPanelOpen, setPanelOpen, removeTask, clearCompleted } = useTaskStore();
  const activeTasksCount = tasks.filter((task) => task.status === 'running').length;
  const { t } = useTranslation();

  if (!isPanelOpen && tasks.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {isPanelOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-50 flex max-h-[600px] w-96 flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Loader2
                  className={`h-4 w-4 text-zinc-900 ${
                    activeTasksCount > 0 ? 'animate-spin' : 'hidden'
                  }`}
                />
                {activeTasksCount === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                ) : null}
              </div>
              <span className="text-sm font-bold text-zinc-900">
                {activeTasksCount > 0
                  ? t('taskManager.activeTasks', { count: activeTasksCount })
                  : t('taskManager.allCompleted')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {tasks.some((task) => task.status === 'success') ? (
                <button
                  onClick={clearCompleted}
                  className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-700"
                  title={t('taskManager.clearCompleted')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="scrollbar-hide space-y-1 overflow-y-auto bg-zinc-50/30 p-2">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {t('taskManager.noRecentTasks')}
              </div>
            ) : (
              tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group rounded-xl border border-zinc-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <TaskIcon type={task.type} status={task.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-semibold text-zinc-900">
                          {task.title}
                        </h4>
                        <button
                          onClick={() => removeTask(task.id)}
                          className="rounded p-1 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {task.subtitle ? (
                        <p className="mb-2 truncate text-xs text-zinc-500">{task.subtitle}</p>
                      ) : null}

                      {task.status === 'running' ? (
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                            <span>
                              {task.progress < 100
                                ? t('taskManager.processing')
                                : t('taskManager.finalizing')}
                            </span>
                            <span>{Math.round(task.progress)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                            <motion.div
                              className="h-full rounded-full bg-zinc-900"
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                              transition={{ ease: 'linear', duration: 0.5 }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {task.status === 'error' ? (
                        <p className="mt-1 text-xs font-medium text-red-500">
                          {t('taskManager.failedTryAgain')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
