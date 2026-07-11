import { AlertTriangle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import type {
  BundledOpenClawStartupAlert,
  BundledOpenClawStartupAlertDiagnostic,
} from '../services';

interface BuiltInOpenClawStartupBannerProps {
  instanceName: string;
  alert: BundledOpenClawStartupAlert;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry?: () => void;
  onOpenDetails: () => void;
  onOpenDiagnosticPath?: (
    diagnostic: BundledOpenClawStartupAlertDiagnostic,
  ) => Promise<void> | void;
  t: (key: string) => string;
}

function getDiagnosticActionLabelKey(
  diagnosticId: BundledOpenClawStartupAlertDiagnostic['id'],
) {
  switch (diagnosticId) {
    case 'gatewayLogPath':
      return 'instances.detail.actions.openGatewayLog';
    case 'desktopMainLogPath':
      return 'instances.detail.actions.revealDesktopMainLog';
    default:
      return null;
  }
}

function getDiagnosticActionLabel(
  diagnosticId: BundledOpenClawStartupAlertDiagnostic['id'],
  t: (key: string) => string,
) {
  const labelKey = getDiagnosticActionLabelKey(diagnosticId);
  if (!labelKey) {
    return null;
  }

  const translated = t(labelKey);
  if (translated !== labelKey) {
    return translated;
  }

  return diagnosticId === 'gatewayLogPath' ? 'Open Gateway Log' : 'Reveal Desktop Log';
}

export function BuiltInOpenClawStartupBanner({
  instanceName,
  alert,
  canRetry,
  isRetrying,
  onRetry,
  onOpenDetails,
  onOpenDiagnosticPath,
  t,
}: BuiltInOpenClawStartupBannerProps) {
  return (
    <section className="mb-8 rounded-[1.75rem] border border-amber-300/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,247,237,0.96))] p-6 shadow-sm shadow-amber-950/5 dark:border-amber-800/80 dark:bg-[linear-gradient(135deg,rgba(69,26,3,0.36),rgba(120,53,15,0.2))] dark:shadow-none">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white/85 text-amber-700 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  {t(alert.titleKey)}
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-amber-950 dark:text-amber-50">
                  {instanceName}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-900/85 dark:text-amber-100/85">
                  {t(alert.detailKey)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 xl:justify-end">
            {canRetry && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/80 bg-white/90 px-4 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/55"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t(
                  isRetrying
                    ? 'instances.detail.actions.retryingBundledStartup'
                    : 'instances.detail.actions.retryBundledStartup',
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/90 bg-transparent px-4 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-white/55 dark:border-amber-800/70 dark:text-amber-100 dark:hover:bg-amber-950/35"
            >
              {t('instances.list.actions.details')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white/75 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            {t(
              'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.recommendedActionLabel',
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
            {t(alert.recommendedActionDetailKey)}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white/85 px-4 py-3 font-mono text-sm leading-6 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-50">
          {alert.message}
        </div>

        {alert.diagnostics.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {alert.diagnostics.map((diagnostic) => (
              <div
                key={diagnostic.id}
                className="rounded-2xl border border-amber-200/80 bg-white/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/30"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  {t(diagnostic.labelKey)}
                </div>
                <div
                  className={`mt-3 break-all text-sm font-semibold text-amber-950 dark:text-amber-50 ${
                    diagnostic.mono ? 'font-mono' : ''
                  }`}
                >
                  {diagnostic.value}
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
                  {t(diagnostic.detailKey)}
                </p>
                {getDiagnosticActionLabel(diagnostic.id, t) && onOpenDiagnosticPath ? (
                  <div className="mt-4 flex flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => void onOpenDiagnosticPath(diagnostic)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/80 bg-white/90 px-3.5 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-white dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/55"
                    >
                      {getDiagnosticActionLabel(diagnostic.id, t)}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
