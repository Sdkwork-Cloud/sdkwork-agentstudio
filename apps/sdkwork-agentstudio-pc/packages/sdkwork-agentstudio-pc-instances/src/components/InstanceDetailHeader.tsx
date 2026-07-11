import React from 'react';
import { CheckCircle2, Power, RefreshCw, Server, Trash2, Wrench } from 'lucide-react';
import type { Instance } from '../types';

interface InstanceDetailHeaderProps {
  activeInstanceId: string | null;
  instance: Pick<Instance, 'id' | 'name' | 'status' | 'ip' | 'uptime' | 'type' | 'version'>;
  canSetActive: boolean;
  canOpenControlPage: boolean;
  canControlLifecycle: boolean;
  canRestartLifecycle: boolean;
  canStopLifecycle: boolean;
  canStartLifecycle: boolean;
  canDelete: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  getSharedStatusLabel: (status: string) => string;
  getStatusBadge: (status: string) => string;
  onSetActive: () => void;
  onOpenControlPage: () => void;
  onRestart: () => void;
  onStop: () => void;
  onStart: () => void;
  onDelete: () => void;
}

export function InstanceDetailHeader({
  activeInstanceId,
  instance,
  canSetActive,
  canOpenControlPage,
  canControlLifecycle,
  canRestartLifecycle,
  canStopLifecycle,
  canStartLifecycle,
  canDelete,
  t,
  getSharedStatusLabel,
  getStatusBadge,
  onSetActive,
  onOpenControlPage,
  onRestart,
  onStop,
  onStart,
  onDelete,
}: InstanceDetailHeaderProps) {
  return (
    <div data-slot="instance-detail-header" className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 dark:text-primary-300">
          <Server className="h-8 w-8" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {instance.name}
            </h1>
            {activeInstanceId === instance.id ? (
              <div className="flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('instances.detail.activeBadge')}
              </div>
            ) : null}
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusBadge(
                instance.status,
              )}`}
            >
              {getSharedStatusLabel(instance.status)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-mono">{instance.ip}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>{t('instances.detail.uptime', { value: instance.uptime })}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>{instance.type}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>{instance.version}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {activeInstanceId !== instance.id && canSetActive ? (
          <button
            type="button"
            onClick={onSetActive}
            className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('instances.detail.actions.setAsActive')}
          </button>
        ) : null}
        {canOpenControlPage ? (
          <button
            type="button"
            onClick={onOpenControlPage}
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Wrench className="h-4 w-4" />
            {t('instances.detail.actions.openControlPage')}
          </button>
        ) : null}
        {canControlLifecycle ? (
          <>
            {canRestartLifecycle ? (
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <RefreshCw className="h-4 w-4" />
                {t('instances.detail.actions.restart')}
              </button>
            ) : null}
            {canStopLifecycle ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.stop')}
              </button>
            ) : null}
            {canStartLifecycle ? (
              <button
                type="button"
                onClick={onStart}
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.start')}
              </button>
            ) : null}
          </>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {t('instances.detail.actions.uninstallInstance')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
