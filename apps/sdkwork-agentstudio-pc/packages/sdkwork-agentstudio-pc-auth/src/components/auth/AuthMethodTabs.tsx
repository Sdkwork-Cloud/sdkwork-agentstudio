import type { ReactNode } from 'react';

interface AuthMethodTabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

interface AuthMethodTabsProps {
  value: string;
  items: AuthMethodTabItem[];
  onChange: (value: string) => void;
}

export function AuthMethodTabs({
  value,
  items,
  onChange,
}: AuthMethodTabsProps) {
  const gridClass =
    items.length <= 1
      ? 'grid-cols-1'
      : items.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-3';

  return (
    <div className="rounded-2xl bg-zinc-100/80 p-1 dark:bg-zinc-900/80">
      <div className={`grid gap-1 ${gridClass}`}>
        {items.map((item) => {
          const isActive = item.value === value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white'
                  : 'bg-transparent text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950/70 dark:hover:text-zinc-100'
              }`}
            >
              {item.icon ? (
                <span className={`${isActive ? 'text-primary-600 dark:text-primary-200' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
