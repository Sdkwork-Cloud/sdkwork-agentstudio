import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatWorkbenchLabel } from '../services';
import type { Instance } from '../types';

interface UnsupportedInstanceDetailPageProps {
  instance: Instance;
  kernelId: string;
}

export function UnsupportedInstanceDetailPage({
  instance,
  kernelId,
}: UnsupportedInstanceDetailPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="w-full p-4 md:p-6 xl:p-8 2xl:p-10">
      <button
        onClick={() => navigate('/instances')}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instances.detail.backToInstances')}
      </button>

      <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-zinc-900/82 md:p-8">
        <div className="rounded-[1.75rem] border border-amber-500/20 bg-amber-500/[0.07] p-6">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
            <CircleAlert className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.16em]">
              {t('instances.detail.modules.unsupported.eyebrow')}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {instance.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {t('instances.detail.modules.unsupported.description', {
              kernel: formatWorkbenchLabel(kernelId),
            })}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950/35 dark:text-zinc-200">
              {formatWorkbenchLabel(kernelId)}
            </span>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-950/35 dark:text-zinc-200">
              {instance.type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
