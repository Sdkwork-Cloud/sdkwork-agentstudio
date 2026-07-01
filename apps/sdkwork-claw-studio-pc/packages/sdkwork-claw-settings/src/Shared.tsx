import React, { useState } from 'react';
import { Switch } from '@sdkwork/claw-ui';

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <h3 className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle?: () => void;
}) {
  const [localEnabled, setLocalEnabled] = useState(enabled);

  React.useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleToggle = () => {
    setLocalEnabled(!localEnabled);
    onToggle?.();
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
      </div>
      <Switch checked={localEnabled} onCheckedChange={handleToggle} />
    </div>
  );
}
