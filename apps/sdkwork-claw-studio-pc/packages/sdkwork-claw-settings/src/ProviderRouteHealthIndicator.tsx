import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LocalAiProxyRouteHealth } from '@sdkwork/claw-types';
import { AlertTriangle, Ban, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProviderRouteHealthIndicatorProps {
  health: LocalAiProxyRouteHealth;
  toneClassName: string;
  healthLabel: string;
  lastErrorMessage: string;
  averageLatencyLabel: string;
  rpmLabel: string;
  latestTestDetail: string;
  updatedAtLabel: string;
}

interface ProviderRouteHealthPopoverPosition {
  left: number;
  top: number;
}

function resolveRouteHealthIcon(health: LocalAiProxyRouteHealth) {
  switch (health) {
    case 'healthy':
      return CheckCircle2;
    case 'failed':
      return XCircle;
    case 'disabled':
      return Ban;
    default:
      return AlertTriangle;
  }
}

export function ProviderRouteHealthIndicator({
  health,
  toneClassName,
  healthLabel,
  lastErrorMessage,
  averageLatencyLabel,
  rpmLabel,
  latestTestDetail,
  updatedAtLabel,
}: ProviderRouteHealthIndicatorProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ProviderRouteHealthPopoverPosition>({
    left: 12,
    top: 12,
  });
  const HealthIcon = resolveRouteHealthIcon(health);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearCloseTimer();
    setIsOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 80);
  };

  useEffect(() => () => clearCloseTimer(), []);

  useLayoutEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const viewportPadding = 12;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popoverRef.current?.getBoundingClientRect();
      const popoverWidth = Math.min(
        popoverRect?.width ?? 340,
        window.innerWidth - viewportPadding * 2,
      );
      const popoverHeight = popoverRect?.height ?? 220;
      const nextLeft = Math.min(
        Math.max(triggerRect.left, viewportPadding),
        window.innerWidth - popoverWidth - viewportPadding,
      );
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const nextTop = spaceBelow >= popoverHeight + 10
        ? triggerRect.bottom + 10
        : Math.max(viewportPadding, triggerRect.top - popoverHeight - 10);

      setPosition({
        left: nextLeft,
        top: nextTop,
      });
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [
    isOpen,
    averageLatencyLabel,
    healthLabel,
    lastErrorMessage,
    latestTestDetail,
    rpmLabel,
    updatedAtLabel,
  ]);

  return (
    <div className="inline-flex min-w-max" data-slot="provider-center-health-indicator">
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex min-w-max flex-nowrap items-center justify-start gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${toneClassName}`}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={openPopover}
        onBlur={scheduleClose}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <HealthIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0 whitespace-nowrap">{healthLabel}</span>
      </button>
      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[160] w-[340px] max-w-[calc(100vw-24px)] rounded-[22px] border border-zinc-200 bg-white/98 p-4 text-left shadow-[0_24px_72px_-28px_rgba(15,23,42,0.42)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/98"
              style={position}
              onMouseEnter={openPopover}
              onMouseLeave={scheduleClose}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                <HealthIcon className="h-3.5 w-3.5 shrink-0" />
                {healthLabel}
              </div>
              <div className="mt-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
                {lastErrorMessage}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center justify-between gap-3">
                  <span>{t('providerCenter.table.avgLatency')}</span>
                  <span className="font-medium text-right text-zinc-700 dark:text-zinc-200">
                    {averageLatencyLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('providerCenter.table.rpm')}</span>
                  <span className="font-medium text-right text-zinc-700 dark:text-zinc-200">
                    {rpmLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('providerCenter.table.lastTest')}</span>
                  <span className="font-medium text-right text-zinc-700 dark:text-zinc-200">
                    {latestTestDetail}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('providerCenter.table.updatedAt')}</span>
                  <span className="font-medium text-right text-zinc-700 dark:text-zinc-200">
                    {updatedAtLabel}
                  </span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
