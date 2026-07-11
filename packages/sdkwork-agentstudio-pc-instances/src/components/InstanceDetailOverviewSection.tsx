import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { buildInstanceDetailBadgeDescriptors } from '../pages/instanceDetailBadgeDescriptors.ts';
import type {
  BundledOpenClawStartupAlertDiagnostic,
  InstanceManagementSummary,
} from '../services';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric, WorkbenchRow, WorkbenchRowList } from './InstanceWorkbenchPrimitives.tsx';

interface InstanceDetailOverviewSectionProps {
  detail: InstanceWorkbenchSnapshot['detail'];
  managementSummary: InstanceManagementSummary | null;
  canRetryBundledStartup?: boolean;
  isRetryingBundledStartup?: boolean;
  t: (key: string) => string;
  formatWorkbenchLabel: (value: string) => string;
  getCapabilityTone: (status: string) => string;
  getRuntimeStatusTone: (status: string) => string;
  getManagementEntryTone: (tone: 'neutral' | 'success' | 'warning') => string;
  onRetryBundledStartup?: () => void;
  onOpenDiagnosticPath?: (
    diagnostic: BundledOpenClawStartupAlertDiagnostic,
  ) => Promise<void> | void;
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

export function InstanceDetailOverviewSection({
  detail,
  managementSummary,
  canRetryBundledStartup = false,
  isRetryingBundledStartup = false,
  t,
  formatWorkbenchLabel,
  getCapabilityTone,
  getRuntimeStatusTone,
  getManagementEntryTone,
  onRetryBundledStartup,
  onOpenDiagnosticPath,
}: InstanceDetailOverviewSectionProps) {
  return (
    <div data-slot="instance-detail-overview" className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.identity')}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[detail.instance.runtimeKind, detail.instance.deploymentMode, detail.instance.transportKind].map(
              (value) => (
                <span
                  key={value}
                  className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                >
                  {formatWorkbenchLabel(value)}
                </span>
              ),
            )}
          </div>
          <div className="mt-5 space-y-3">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.lifecycle')}
              value={formatWorkbenchLabel(detail.lifecycle.owner)}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.host')}
              value={detail.instance.host}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.version')}
              value={detail.instance.version}
            />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.storage')}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                detail.storage.status,
              )}`}
            >
              {formatWorkbenchLabel(detail.storage.status)}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {formatWorkbenchLabel(detail.storage.provider)}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.profile')}
              value={detail.storage.profileId || '--'}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.namespace')}
              value={detail.storage.namespace}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.database')}
              value={detail.storage.database || '--'}
            />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.observability')}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getRuntimeStatusTone(
                detail.health.status,
              )}`}
            >
              {t(`instances.detail.instanceWorkbench.runtimeStates.${detail.health.status}`)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                detail.observability.status,
              )}`}
            >
              {formatWorkbenchLabel(detail.observability.status)}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.healthChecks')}
              value={detail.health.checks.length}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.overview.logLines')}
              value={detail.observability.logPreview.length}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.metrics.updatedAt')}
              value={
                detail.observability.lastSeenAt
                  ? new Date(detail.observability.lastSeenAt).toLocaleString()
                  : '--'
              }
            />
          </div>
        </div>
      </div>

      {managementSummary ? (
        <div
          data-slot="instance-detail-management-summary"
          className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.management.title')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.management.description')}
              </p>
            </div>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {managementSummary.entries.length}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
            {managementSummary.entries.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-[1.3rem] border p-4 ${getManagementEntryTone(entry.tone)}`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t(entry.labelKey)}
                </div>
                <div
                  className={`mt-3 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50 ${
                    entry.mono ? 'font-mono text-[13px]' : ''
                  }`}
                >
                  {entry.value}
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {t(entry.detailKey)}
                </p>
              </div>
            ))}
          </div>

          {managementSummary.alert ? (
            <div className="mt-5 rounded-[1.3rem] border border-amber-300/80 bg-amber-50/80 p-4 text-amber-950 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/20 dark:text-amber-100">
              <div
                data-slot="instance-detail-management-alert"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300"
              >
                {t(managementSummary.alert.titleKey)}
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-900/85 dark:text-amber-100/85">
                {t(managementSummary.alert.detailKey)}
              </p>
              <div className="mt-3 rounded-2xl border border-amber-200/80 bg-white/70 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                  {t(
                    'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.recommendedActionLabel',
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
                  {t(managementSummary.alert.recommendedActionDetailKey)}
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 font-mono text-sm leading-6 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-50">
                {managementSummary.alert.message}
              </div>
              {managementSummary.alert.diagnostics.length > 0 ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {managementSummary.alert.diagnostics.map((diagnostic) => (
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
              {canRetryBundledStartup && onRetryBundledStartup ? (
                <div className="mt-3 flex flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={onRetryBundledStartup}
                    disabled={isRetryingBundledStartup}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/80 bg-white/85 px-4 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/55"
                  >
                    {isRetryingBundledStartup ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t(
                      isRetryingBundledStartup
                        ? 'instances.detail.actions.retryingBundledStartup'
                        : 'instances.detail.actions.retryBundledStartup',
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {managementSummary.notes.length > 0 ? (
            <div className="mt-5 rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.management.notes')}
              </div>
              <div className="mt-3 space-y-2">
                {managementSummary.notes.map((note) => (
                  <p key={note} className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        data-slot="instance-detail-connectivity"
        className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.connectivity')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.connectivityDescription')}
            </p>
          </div>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {detail.connectivity.endpoints.length}
          </span>
        </div>

        {detail.connectivity.endpoints.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {detail.connectivity.endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {endpoint.label}
                  </h4>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                      endpoint.status,
                    )}`}
                  >
                    {formatWorkbenchLabel(endpoint.status)}
                  </span>
                </div>
                <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {endpoint.url || '--'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {buildInstanceDetailBadgeDescriptors(endpoint.id, [
                    { slot: 'kind', value: endpoint.kind },
                    { slot: 'exposure', value: endpoint.exposure },
                    { slot: 'auth', value: endpoint.auth },
                  ]).map((badge) => (
                    <span
                      key={badge.key}
                      className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                    >
                      {formatWorkbenchLabel(badge.value)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.noConnectivity')}
          </div>
        )}
      </div>

      <div
        data-slot="instance-detail-capability-matrix"
        className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.capabilities')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.capabilitiesDescription')}
            </p>
          </div>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {detail.capabilities.length}
          </span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {detail.capabilities.map((capability) => (
            <div
              key={capability.id}
              className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {formatWorkbenchLabel(capability.id)}
                </h4>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                    capability.status,
                  )}`}
                >
                  {formatWorkbenchLabel(capability.status)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {capability.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        data-slot="instance-detail-data-access"
        className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.dataAccess')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.dataAccessDescription')}
            </p>
          </div>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {detail.dataAccess.routes.length}
          </span>
        </div>

        {detail.dataAccess.routes.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {detail.dataAccess.routes.map((route) => (
              <div
                key={route.id}
                className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {route.label}
                  </h4>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                      route.status,
                    )}`}
                  >
                    {formatWorkbenchLabel(route.status)}
                  </span>
                </div>
                <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {route.target || '--'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {buildInstanceDetailBadgeDescriptors(route.id, [
                    { slot: 'scope', value: route.scope },
                    { slot: 'mode', value: route.mode },
                    { slot: 'source', value: route.source },
                  ]).map((badge) => (
                    <span
                      key={badge.key}
                      className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                    >
                      {formatWorkbenchLabel(badge.value)}
                    </span>
                  ))}
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {formatWorkbenchLabel(route.authoritative ? 'authoritative' : 'derived')}
                  </span>
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {formatWorkbenchLabel(route.readonly ? 'readonly' : 'writable')}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {route.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.noDataAccess')}
          </div>
        )}
      </div>

      <div
        data-slot="instance-detail-artifacts"
        className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.artifacts')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.artifactsDescription')}
            </p>
          </div>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {detail.artifacts.length}
          </span>
        </div>

        {detail.artifacts.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {detail.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {artifact.label}
                  </h4>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                      artifact.status,
                    )}`}
                  >
                    {formatWorkbenchLabel(artifact.status)}
                  </span>
                </div>
                <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {artifact.location || '--'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {buildInstanceDetailBadgeDescriptors(artifact.id, [
                    { slot: 'kind', value: artifact.kind },
                    { slot: 'source', value: artifact.source },
                  ]).map((badge) => (
                    <span
                      key={badge.key}
                      className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                    >
                      {formatWorkbenchLabel(badge.value)}
                    </span>
                  ))}
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {formatWorkbenchLabel(artifact.readonly ? 'readonly' : 'writable')}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {artifact.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.overview.noArtifacts')}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <WorkbenchRowList>
          {detail.health.checks.map((check, index) => (
            <WorkbenchRow key={check.id} isLast={index === detail.health.checks.length - 1}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {check.label}
                  </h3>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getRuntimeStatusTone(
                      check.status,
                    )}`}
                  >
                    {t(`instances.detail.instanceWorkbench.runtimeStates.${check.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {check.detail}
                </p>
              </div>
              <div className="flex flex-wrap gap-5">
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.summary.healthScore')}
                  value={`${detail.health.score}%`}
                />
              </div>
              <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                {detail.health.evaluatedAt
                  ? new Date(detail.health.evaluatedAt).toLocaleString()
                  : '--'}
              </div>
            </WorkbenchRow>
          ))}
        </WorkbenchRowList>

        <div className="space-y-4">
          <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.runtimeNotes')}
            </h3>
            <div className="mt-4 space-y-4">
              {detail.officialRuntimeNotes.map((note) => (
                <div
                  key={note.title}
                  className="rounded-2xl bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]"
                >
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {note.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.overview.logPreview')}
            </h3>
            <div className="mt-4 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-xs leading-6 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300 whitespace-pre-wrap">
              {detail.observability.logPreview.length > 0
                ? detail.observability.logPreview.join('\n')
                : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
