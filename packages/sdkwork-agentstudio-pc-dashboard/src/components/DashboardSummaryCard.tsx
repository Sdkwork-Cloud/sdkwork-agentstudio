import type { ReactNode } from 'react';

export function DashboardSummaryCard({
  eyebrow,
  title,
  description,
  accent,
  changeLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent?: ReactNode;
  changeLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 relative overflow-hidden rounded-[1.9rem] border border-white/70 bg-white/82 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/82">
      <div className="pointer-events-none absolute right-5 top-2 h-24 w-24 rounded-full bg-primary-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
          {changeLabel ? (
            <span className="inline-flex items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-200">
              {changeLabel}
            </span>
          ) : null}
          {accent}
        </div>
      </div>

      <div className="relative mt-5">{children}</div>
    </section>
  );
}
