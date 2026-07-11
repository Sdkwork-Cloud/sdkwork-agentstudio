import React from 'react';

interface InstanceConfigWorkbenchStatusChipProps {
  children: React.ReactNode;
  tone?: string;
}

export function InstanceConfigWorkbenchStatusChip(
  props: InstanceConfigWorkbenchStatusChipProps,
) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        props.tone ||
        'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
      }`}
    >
      {props.children}
    </span>
  );
}
