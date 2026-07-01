import type { ReactNode } from 'react';

export function MetricCard({
  eyebrow,
  title,
  value,
  description,
  accent,
  changeLabel,
  meta,
  tone = 'neutral',
}: {
  eyebrow: string;
  title: string;
  value: string;
  description: string;
  accent?: ReactNode;
  changeLabel?: string;
  meta?: string;
  tone?: 'primary' | 'positive' | 'warning' | 'critical' | 'neutral';
}) {
  const toneClasses = {
    primary: {
      glow: 'bg-primary-500/18',
      badge:
        'border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-200',
    },
    positive: {
      glow: 'bg-emerald-500/16',
      badge:
        'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    },
    warning: {
      glow: 'bg-amber-500/16',
      badge: 'border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200',
    },
    critical: {
      glow: 'bg-rose-500/16',
      badge: 'border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200',
    },
    neutral: {
      glow: 'bg-zinc-500/10',
      badge: 'border border-zinc-500/15 bg-zinc-950/[0.04] text-zinc-600 dark:text-zinc-300',
    },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/82">
      <div className={`pointer-events-none absolute right-5 top-2 h-24 w-24 rounded-full ${toneClasses.glow} blur-3xl`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
          <h3 className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</h3>
        </div>
        <div className="flex flex-col items-end gap-3">
          {changeLabel ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses.badge}`}
            >
              {changeLabel}
            </span>
          ) : null}
          {accent}
        </div>
      </div>
      <div className="relative mt-5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <p className="relative mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {meta ? (
        <div className="relative mt-4 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
