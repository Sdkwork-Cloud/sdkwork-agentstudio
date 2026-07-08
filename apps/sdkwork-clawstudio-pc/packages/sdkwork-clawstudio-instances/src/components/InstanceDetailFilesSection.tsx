import React from 'react';
import { InstanceFilesWorkspace } from './InstanceFilesWorkspace';
import type { InstanceConfig, InstanceWorkbenchSnapshot } from '../types/index.ts';

interface InstanceDetailFilesSectionProps {
  instanceId: string;
  config: InstanceConfig | null;
  workbench: InstanceWorkbenchSnapshot | null;
  detail: InstanceWorkbenchSnapshot['detail'] | null;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
  isLoading?: boolean;
  t: (key: string) => string;
  onReload: () => Promise<void> | void;
}

export function InstanceDetailFilesSection({
  instanceId,
  config,
  workbench,
  detail,
  selectedAgentId,
  onSelectedAgentIdChange,
  isLoading,
  t,
  onReload,
}: InstanceDetailFilesSectionProps) {
  return (
    <div data-slot="instance-detail-files" className="space-y-6">
      <div className="rounded-[1.6rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
        <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('instances.detail.instanceWorkbench.files.gatewayProfile')}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.files.gatewayProfileDescription')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {t('instances.detail.fields.gatewayPort')}: {config?.port}
          </span>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {t('instances.detail.fields.corsOrigins')}: {config?.corsOrigins}
          </span>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {t('instances.detail.fields.agentSandbox')}:{' '}
            {config?.sandbox
              ? t('instances.detail.instanceWorkbench.files.on')
              : t('instances.detail.instanceWorkbench.files.off')}
          </span>
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {t('instances.detail.fields.autoUpdate')}:{' '}
            {config?.autoUpdate
              ? t('instances.detail.instanceWorkbench.files.on')
              : t('instances.detail.instanceWorkbench.files.off')}
          </span>
        </div>
      </div>

      <InstanceFilesWorkspace
        mode="instance"
        instanceId={instanceId}
        files={workbench?.files || []}
      agents={workbench?.agents || []}
      selectedAgentId={selectedAgentId}
      onSelectedAgentIdChange={onSelectedAgentIdChange}
      runtimeKind={detail?.instance.runtimeKind}
      transportKind={detail?.instance.transportKind}
      isBuiltIn={detail?.instance.isBuiltIn}
      isLoading={isLoading}
      onReload={onReload}
    />
    </div>
  );
}
