import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Server, ShieldCheck, Waypoints, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { openExternalUrl } from '@sdkwork/agentstudio-pc-infrastructure';
import { toast } from 'sonner';
import { Button } from '@sdkwork/agentstudio-pc-ui';
import {
  buildInstanceConsoleHandlers,
  formatWorkbenchLabel,
  getHermesInstanceDetailModulePayload,
  type InstanceBaseDetail,
  type InstanceDetailPageProps,
  type HermesInstanceDetailModulePayload,
} from '../services';

interface HermesMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
}

function buildHermesMetrics(detail: InstanceBaseDetail): HermesMetric[] {
  return [
    {
      id: 'runtime',
      label: 'instances.detail.modules.hermes.metrics.runtime',
      value: detail.instance.version || '--',
      detail: formatWorkbenchLabel(detail.instance.kernelId),
    },
    {
      id: 'deployment',
      label: 'instances.detail.modules.hermes.metrics.deployment',
      value: formatWorkbenchLabel(detail.instance.deploymentMode),
      detail: formatWorkbenchLabel(detail.lifecycle.owner),
    },
    {
      id: 'transport',
      label: 'instances.detail.modules.hermes.metrics.transport',
      value: formatWorkbenchLabel(detail.instance.transportId),
      detail: detail.connectivity.endpoints[0]?.url || '--',
    },
    {
      id: 'health',
      label: 'instances.detail.modules.hermes.metrics.health',
      value: formatWorkbenchLabel(detail.health.status),
      detail: `${detail.health.score}/100`,
    },
  ];
}

function buildCapabilityTone(status: string) {
  if (status === 'ready') {
    return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'degraded') {
    return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
  }
  return 'bg-zinc-950/[0.05] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300';
}

function buildReadinessTone(status: string) {
  if (status === 'configured') {
    return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'required') {
    return 'bg-rose-500/12 text-rose-700 dark:text-rose-300';
  }
  return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
}

export function HermesInstanceDetailPage({
  source,
  onOpenAgentMarketModal: _onOpenAgentMarketModal,
}: InstanceDetailPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [baseDetail, setBaseDetail] = useState<InstanceBaseDetail | null>(null);
  const [modulePayload, setModulePayload] = useState<HermesInstanceDetailModulePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    void Promise.all([source.loadBaseDetail(), source.loadModulePayload()])
      .then(([nextBaseDetail, nextModulePayload]) => {
        if (isCancelled) {
          return;
        }
        setBaseDetail(nextBaseDetail);
        setModulePayload(getHermesInstanceDetailModulePayload(nextModulePayload));
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setBaseDetail(null);
        setModulePayload(null);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    source.instanceId,
    source.kernelId,
    source.loadBaseDetail,
    source.loadModulePayload,
  ]);

  const metrics = useMemo(
    () => (baseDetail ? buildHermesMetrics(baseDetail) : []),
    [baseDetail],
  );
  const runtimePolicies = useMemo(
    () => modulePayload?.sections.runtimePolicies || [],
    [modulePayload],
  );
  const readinessChecks = useMemo(
    () => modulePayload?.sections.readinessChecks || [],
    [modulePayload],
  );
  const notes = useMemo(
    () => modulePayload?.sections.notes || [],
    [modulePayload],
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-6xl items-center justify-center p-4 md:p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!baseDetail) {
    return (
      <div className="mx-auto max-w-6xl p-4 text-center md:p-8">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('instances.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/instances')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('instances.detail.returnToInstances')}
        </button>
      </div>
    );
  }

  const detail = baseDetail;
  const consoleAvailability = detail.management.consoleAvailability ?? null;
  const canOpenControlPage = Boolean(
    consoleAvailability?.available && (consoleAvailability.autoLoginUrl || consoleAvailability.entryUrl),
  );
  const consoleHandlers = buildInstanceConsoleHandlers({
    consoleTarget: consoleAvailability
      ? {
          url: consoleAvailability.entryUrl,
          autoLoginUrl: consoleAvailability.autoLoginUrl,
          reason: consoleAvailability.reason,
        }
      : null,
    openExternalLink: openExternalUrl,
    reportInfo: (message) => {
      toast.info(message);
    },
    reportError: (message) => {
      toast.error(message);
    },
    t,
  });

  return (
    <div className="w-full p-4 md:p-6 xl:p-8 2xl:p-10">
      <button
        onClick={() => navigate('/instances')}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instances.detail.backToInstances')}
      </button>

      <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-zinc-900/82 md:p-8">
        {canOpenControlPage ? (
          <div className="mb-6 flex justify-end">
            <Button variant="outline" onClick={() => void consoleHandlers.onOpenControlPage()}>
              <Wrench className="h-4 w-4" />
              {t('instances.detail.actions.openControlPage')}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.95fr)]">
          <section className="rounded-[1.75rem] bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(20,83,45,0.88))] p-6 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {t('instances.detail.modules.hermes.eyebrow')}
              </span>
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/85">
                {formatWorkbenchLabel(detail.instance.deploymentMode)}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              {detail.instance.displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/74 md:text-base">
              {t('instances.detail.modules.hermes.description')}
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={metric.id}
                  className="rounded-[1.4rem] border border-white/10 bg-white/8 p-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    {t(metric.label)}
                  </div>
                  <div className="mt-3 text-xl font-semibold text-white">
                    {metric.value}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-white/65">
                    {metric.detail}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <ShieldCheck className="h-4 w-4" />
              {t('instances.detail.modules.hermes.runtimePolicies.title')}
            </div>
            <div className="mt-4 space-y-3">
              {runtimePolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-[1.3rem] bg-white/75 p-4 dark:bg-zinc-950/35"
                >
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t(policy.titleKey)}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {t(policy.detailKey)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <ShieldCheck className="h-4 w-4" />
              {t('instances.detail.modules.hermes.readiness.title')}
            </div>
            <div className="mt-4 space-y-3">
              {readinessChecks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-[1.3rem] bg-white/75 p-4 dark:bg-zinc-950/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t(check.labelKey)}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${buildReadinessTone(
                        check.status,
                      )}`}
                    >
                      {formatWorkbenchLabel(check.status)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {t(check.detailKey)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-[1.75rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <Globe className="h-4 w-4" />
              {t('instances.detail.modules.hermes.endpointsTitle')}
            </div>
            <div className="mt-4 space-y-3">
              {detail.connectivity.endpoints.length === 0 ? (
                <div className="rounded-[1.3rem] bg-white/75 p-4 text-sm text-zinc-500 dark:bg-zinc-950/35 dark:text-zinc-400">
                  {t('instances.detail.modules.hermes.emptyEndpoints')}
                </div>
              ) : (
                detail.connectivity.endpoints.map((endpoint) => {
                  const endpointUrl = endpoint.url ?? null;

                  return (
                    <div
                      key={endpoint.id}
                      className="rounded-[1.3rem] bg-white/75 p-4 dark:bg-zinc-950/35"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {endpoint.label}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {formatWorkbenchLabel(endpoint.kind)} / {formatWorkbenchLabel(endpoint.status)}
                          </div>
                        </div>
                        {endpointUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openExternalUrl(endpointUrl)}
                          >
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            {t('instances.detail.modules.hermes.openEndpoint')}
                          </Button>
                        ) : null}
                      </div>
                      {endpointUrl ? (
                        <div className="mt-3 break-all rounded-xl bg-zinc-950/[0.04] px-3 py-2 font-mono text-xs text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                          {endpointUrl}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <Waypoints className="h-4 w-4" />
              {t('instances.detail.modules.hermes.capabilitiesTitle')}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.capabilities.map((capability) => (
                <span
                  key={capability.id}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${buildCapabilityTone(
                    capability.status,
                  )}`}
                >
                  {formatWorkbenchLabel(capability.id)}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <Server className="h-4 w-4" />
              {t('instances.detail.modules.hermes.notesTitle')}
            </div>
            <div className="mt-4 space-y-3">
              {notes.length === 0 ? (
                <div className="rounded-[1.3rem] bg-white/75 p-4 text-sm text-zinc-500 dark:bg-zinc-950/35 dark:text-zinc-400">
                  {t('instances.detail.modules.hermes.emptyNotes')}
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note}
                    className="rounded-[1.3rem] bg-white/75 p-4 text-sm leading-6 text-zinc-600 dark:bg-zinc-950/35 dark:text-zinc-300"
                  >
                    {note}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-[1.75rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <Waypoints className="h-4 w-4" />
              {t('instances.detail.modules.hermes.dataAccessTitle')}
            </div>
            <div className="mt-4 space-y-3">
              {detail.dataAccess.routes.map((route) => (
                <div
                  key={route.id}
                  className="rounded-[1.3rem] bg-white/75 p-4 dark:bg-zinc-950/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {route.label}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatWorkbenchLabel(route.scope)} / {formatWorkbenchLabel(route.mode)}
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-950/[0.06] px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300">
                      {formatWorkbenchLabel(route.status)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {route.detail}
                  </div>
                  {route.target ? (
                    <div className="mt-3 break-all rounded-xl bg-zinc-950/[0.04] px-3 py-2 font-mono text-xs text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {route.target}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <Server className="h-4 w-4" />
              {t('instances.detail.modules.hermes.artifactsTitle')}
            </div>
            <div className="mt-4 space-y-3">
              {detail.artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="rounded-[1.3rem] bg-white/75 p-4 dark:bg-zinc-950/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {artifact.label}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatWorkbenchLabel(artifact.kind)}
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-950/[0.06] px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300">
                      {formatWorkbenchLabel(artifact.status)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {artifact.detail}
                  </div>
                  {artifact.location ? (
                    <div className="mt-3 break-all rounded-xl bg-zinc-950/[0.04] px-3 py-2 font-mono text-xs text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {artifact.location}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
