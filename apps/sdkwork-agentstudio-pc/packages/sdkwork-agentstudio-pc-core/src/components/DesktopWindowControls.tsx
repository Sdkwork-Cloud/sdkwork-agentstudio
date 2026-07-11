import { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform } from '../platform/index.ts';

export interface DesktopWindowControlsProps {
  variant?: 'header' | 'floating';
  className?: string;
  labels?: DesktopWindowControlLabels;
}

export interface DesktopWindowControlLabels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function WindowSizeGlyph({ isMaximized }: { isMaximized: boolean }) {
  if (!isMaximized) {
    return <Square className="h-3.5 w-3.5" />;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path
        d="M9 5h10v10M5 9h10v10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useDesktopWindowMaximized(isDesktop: boolean) {
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      setIsWindowMaximized(false);
      return;
    }

    let active = true;
    let unsubscribe = () => {};

    void (async () => {
      setIsWindowMaximized(await platform.isWindowMaximized());
      unsubscribe = await platform.subscribeWindowMaximized((nextState) => {
        if (!active) {
          return;
        }

        setIsWindowMaximized(nextState);
      });
    })();

    return () => {
      active = false;
      void unsubscribe();
    };
  }, [isDesktop]);

  return isWindowMaximized;
}

function getRootClassName(
  variant: NonNullable<DesktopWindowControlsProps['variant']>,
  className?: string,
) {
  return joinClasses(
    'flex items-stretch',
    variant === 'header'
      ? 'h-full'
      : 'overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/88 shadow-lg shadow-zinc-950/10 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/84',
    className,
  );
}

function getButtonClassName(params: {
  variant: NonNullable<DesktopWindowControlsProps['variant']>;
  intent?: 'default' | 'danger';
  withDivider?: boolean;
}) {
  const { intent = 'default', variant, withDivider = false } = params;

  return joinClasses(
    'flex items-center justify-center transition-colors',
    variant === 'header'
      ? 'h-full w-11 text-zinc-500 dark:text-zinc-300'
      : 'h-10 w-10 text-zinc-500 dark:text-zinc-300',
    intent === 'danger'
      ? 'hover:bg-rose-500 hover:text-white'
      : variant === 'header'
        ? 'hover:bg-zinc-950/[0.06] hover:text-zinc-950 dark:hover:bg-white/[0.1] dark:hover:text-white'
        : 'hover:bg-zinc-950/[0.06] hover:text-zinc-950 dark:hover:bg-white/[0.08] dark:hover:text-white',
    withDivider && variant === 'floating'
      ? 'border-r border-zinc-200/80 dark:border-zinc-800/80'
      : '',
  );
}

function DesktopWindowControlsBase({
  variant = 'header',
  className,
  labels,
}: Required<Pick<DesktopWindowControlsProps, 'labels'>> &
  Omit<DesktopWindowControlsProps, 'labels'>) {
  const isDesktop = platform.getPlatform() === 'desktop';
  const isWindowMaximized = useDesktopWindowMaximized(isDesktop);

  if (!isDesktop) {
    return null;
  }

  const maximizeLabel = isWindowMaximized
    ? labels.restore
    : labels.maximize;

  return (
    <div
      data-tauri-drag-region="false"
      className={getRootClassName(variant, className)}
    >
      <button
        type="button"
        data-tauri-drag-region="false"
        title={labels.minimize}
        aria-label={labels.minimize}
        onClick={() => {
          void platform.minimizeWindow();
        }}
        className={getButtonClassName({
          variant,
          withDivider: true,
        })}
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        title={maximizeLabel}
        aria-label={maximizeLabel}
        onClick={() => {
          void (isWindowMaximized ? platform.restoreWindow() : platform.maximizeWindow());
        }}
        className={getButtonClassName({
          variant,
          withDivider: true,
        })}
      >
        <WindowSizeGlyph isMaximized={isWindowMaximized} />
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        title={labels.close}
        aria-label={labels.close}
        onClick={() => {
          void platform.closeWindow();
        }}
        className={getButtonClassName({
          variant,
          intent: 'danger',
        })}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TranslatedDesktopWindowControls(props: Omit<DesktopWindowControlsProps, 'labels'>) {
  const { t } = useTranslation();

  return (
    <DesktopWindowControlsBase
      {...props}
      labels={{
        minimize: t('common.minimizeWindow'),
        maximize: t('common.maximizeWindow'),
        restore: t('common.restoreWindow'),
        close: t('common.closeWindow'),
      }}
    />
  );
}

export function DesktopWindowControls({
  labels,
  ...props
}: DesktopWindowControlsProps) {
  if (labels) {
    return <DesktopWindowControlsBase {...props} labels={labels} />;
  }

  return <TranslatedDesktopWindowControls {...props} />;
}
