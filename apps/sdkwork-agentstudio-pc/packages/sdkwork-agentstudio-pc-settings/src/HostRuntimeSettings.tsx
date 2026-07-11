import { useTranslation } from 'react-i18next';
import type { KernelCenterDashboard } from './services';
import { Section } from './Shared';

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function renderValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function renderNumberValue(value: number | null | undefined, fallback: string) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

function renderBooleanValue(
  value: boolean | null | undefined,
  yesLabel: string,
  noLabel: string,
  fallback: string,
) {
  if (typeof value !== 'boolean') {
    return fallback;
  }

  return value ? yesLabel : noLabel;
}

export function HostRuntimeSettings({
  dashboard,
}: {
  dashboard: KernelCenterDashboard | null;
}) {
  const { t } = useTranslation();
  const notAvailableLabel = t('settings.kernelCenter.values.notAvailable');
  const noneLabel = t('settings.kernelCenter.values.none');
  const yesLabel = t('settings.kernelCenter.values.yes');
  const noLabel = t('settings.kernelCenter.values.no');
  const hostRuntime = dashboard?.hostRuntime ?? {
    mode: 'web' as const,
    modeLabel: t('settings.kernelCenter.hostRuntime.defaults.webPreview'),
    lifecycle: 'inactive' as const,
    lifecycleLabel: t('settings.kernelCenter.hostRuntime.defaults.inactive'),
    browserManagementSupported: false,
    browserManagementAvailable: false,
    browserManagementLabel: t('settings.kernelCenter.hostRuntime.defaults.browserManagementUnavailable'),
    manageBasePath: null,
    internalBasePath: null,
  };
  const hostRuntimeContract = dashboard?.hostRuntimeContract ?? {
    hostMode: null,
    distributionFamily: null,
    deploymentFamily: null,
    acceleratorProfile: null,
    browserBaseUrl: null,
    hostEndpointId: null,
    hostRequestedPort: null,
    hostActivePort: null,
    hostLoopbackOnly: null,
    hostDynamicPort: null,
    stateStoreDriver: null,
    stateStoreProfileId: null,
    runtimeDataDir: null,
    webDistDir: null,
  };
  const hostPlatform = dashboard?.hostPlatform ?? {
    status: null,
    modeLabel: t('settings.kernelCenter.values.unknown'),
    lifecycleLabel: t('settings.kernelCenter.runtimeStates.unavailable'),
    hostId: null,
    displayName: null,
    version: null,
    desiredStateProjectionVersion: null,
    rolloutEngineVersion: null,
    manageBasePath: null,
    internalBasePath: null,
    capabilityKeys: [],
    capabilityCount: 0,
  };
  const hostEndpoints = dashboard?.hostEndpoints ?? {
    totalEndpoints: 0,
    readyEndpoints: 0,
    conflictedEndpoints: 0,
    dynamicPortEndpoints: 0,
    browserBaseUrl: null,
    rows: [],
  };
  const browserBaseUrl = hostEndpoints.browserBaseUrl;

  return (
    <Section title={t('settings.kernelCenter.hostRuntime.title')}>
      <div data-slot="host-runtime-settings" className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard label={t('settings.kernelCenter.hostRuntime.cards.runtimeMode')} value={hostRuntime.modeLabel} />
          <DetailCard label={t('settings.kernelCenter.hostRuntime.cards.lifecycle')} value={hostRuntime.lifecycleLabel} />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.browserAccess')}
            value={hostRuntime.browserManagementLabel}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.browserBaseUrl')}
            value={renderValue(browserBaseUrl, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.displayName')}
            value={renderValue(hostPlatform.displayName, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.hostId')}
            value={renderValue(hostPlatform.hostId, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.managePath')}
            value={renderValue(hostRuntime.manageBasePath, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.internalPath')}
            value={renderValue(hostRuntime.internalBasePath, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.hostMode')}
            value={renderValue(hostRuntimeContract.hostMode, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.distributionFamily')}
            value={renderValue(hostRuntimeContract.distributionFamily, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.deploymentFamily')}
            value={renderValue(hostRuntimeContract.deploymentFamily, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.acceleratorProfile')}
            value={renderValue(hostRuntimeContract.acceleratorProfile, noneLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.descriptorBrowserBaseUrl')}
            value={renderValue(hostRuntimeContract.browserBaseUrl, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.descriptorEndpointId')}
            value={renderValue(hostRuntimeContract.hostEndpointId, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.stateStoreDriver')}
            value={renderValue(hostRuntimeContract.stateStoreDriver, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.stateStoreProfileId')}
            value={renderValue(hostRuntimeContract.stateStoreProfileId, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.requestedPort')}
            value={renderNumberValue(hostRuntimeContract.hostRequestedPort, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.activePort')}
            value={renderNumberValue(hostRuntimeContract.hostActivePort, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.loopbackOnly')}
            value={renderBooleanValue(hostRuntimeContract.hostLoopbackOnly, yesLabel, noLabel, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.dynamicPort')}
            value={renderBooleanValue(hostRuntimeContract.hostDynamicPort, yesLabel, noLabel, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.runtimeDataDir')}
            value={renderValue(hostRuntimeContract.runtimeDataDir, notAvailableLabel)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.webDistDir')}
            value={renderValue(hostRuntimeContract.webDistDir, notAvailableLabel)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailCard label={t('settings.kernelCenter.hostRuntime.cards.endpoints')} value={String(hostEndpoints.totalEndpoints)} />
          <DetailCard label={t('settings.kernelCenter.hostRuntime.cards.ready')} value={String(hostEndpoints.readyEndpoints)} />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.portFallbacks')}
            value={String(hostEndpoints.conflictedEndpoints)}
          />
          <DetailCard
            label={t('settings.kernelCenter.hostRuntime.cards.dynamicPorts')}
            value={String(hostEndpoints.dynamicPortEndpoints)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="overflow-x-auto" data-slot="host-runtime-endpoints-table">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.endpoint')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.bind')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.requestedPort')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.activePort')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.exposure')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.status')}</th>
                  <th className="px-4 py-3">{t('settings.kernelCenter.hostRuntime.table.conflict')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {hostEndpoints.rows.length === 0
                  ? (
                    <tr>
                      <td
                        className="px-4 py-4 text-zinc-500 dark:text-zinc-400"
                        colSpan={7}
                      >
                        {t('settings.kernelCenter.hostRuntime.table.empty')}
                      </td>
                    </tr>
                  )
                  : hostEndpoints.rows.map((row) => (
                    <tr key={row.endpointId} className="align-top">
                      <td className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {row.endpointId}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.bindHost}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.requestedPort}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.activePort ?? notAvailableLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.exposureLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        <div>{row.statusLabel}</div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {row.portBindingLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {row.conflictSummary ?? noneLabel}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}
