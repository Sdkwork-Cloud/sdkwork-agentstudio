import React from 'react';

export function WorkbenchRowList({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="instance-workbench-row-list"
      className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 bg-white/75 dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      {children}
    </div>
  );
}

export function WorkbenchRow({
  children,
  isLast = false,
}: {
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] xl:items-center ${
        isLast ? '' : 'border-b border-zinc-200/70 dark:border-zinc-800'
      }`}
    >
      {children}
    </div>
  );
}

export function RowMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-[7rem]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

export function SectionAvailabilityNotice({
  statusLabel,
  statusTone,
  detail,
}: {
  statusLabel: string;
  statusTone: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}
