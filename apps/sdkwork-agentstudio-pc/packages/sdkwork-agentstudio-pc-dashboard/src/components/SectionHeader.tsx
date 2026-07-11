import type { ReactNode } from 'react';

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {action ? <div className="max-w-full lg:shrink-0">{action}</div> : null}
    </div>
  );
}
