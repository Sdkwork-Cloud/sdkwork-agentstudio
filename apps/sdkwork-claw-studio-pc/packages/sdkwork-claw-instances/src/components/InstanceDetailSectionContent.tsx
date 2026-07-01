import React from 'react';
import type { ChannelWorkspaceItem } from '@sdkwork/claw-ui';
import type {
  BundledOpenClawStartupAlertDiagnostic,
  InstanceManagementSummary,
} from '../services';
import type {
  InstanceConfig,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import { InstanceDetailChannelsSection } from './InstanceDetailChannelsSection.tsx';
import { InstanceDetailOverviewSection } from './InstanceDetailOverviewSection.tsx';
import { InstanceDetailSkillsSection } from './InstanceDetailSkillsSection.tsx';
import { SectionAvailabilityNotice } from './InstanceWorkbenchPrimitives.tsx';

const LazyInstanceDetailFilesSection = React.lazy(() =>
  import('./InstanceDetailFilesSection.tsx').then((module) => ({
    default: module.InstanceDetailFilesSection,
  })),
);

const LazyInstanceConfigWorkbenchPanel = React.lazy(() =>
  import('./InstanceConfigWorkbenchPanel.tsx').then((module) => ({
    default: module.InstanceConfigWorkbenchPanel,
  })),
);

interface RenderInstanceDetailSectionAvailabilityArgs {
  workbench: Pick<InstanceWorkbenchSnapshot, 'sectionAvailability'> | null;
  sectionId: InstanceWorkbenchSectionId;
  fallbackKey: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatWorkbenchLabel: (value: string) => string;
  getCapabilityTone: (status: string) => string;
}

export function renderInstanceDetailSectionAvailability({
  workbench,
  sectionId,
  fallbackKey,
  t,
  formatWorkbenchLabel,
  getCapabilityTone,
}: RenderInstanceDetailSectionAvailabilityArgs) {
  const availability = workbench?.sectionAvailability[sectionId];

  if (availability && availability.status !== 'ready') {
    return (
      <SectionAvailabilityNotice
        statusLabel={formatWorkbenchLabel(availability.status)}
        statusTone={getCapabilityTone(availability.status)}
        detail={availability.detail}
      />
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
      {t(fallbackKey)}
    </div>
  );
}

interface InstanceDetailSectionContentProps {
  activeSection: InstanceWorkbenchSectionId;
  workbench: InstanceWorkbenchSnapshot | null;
  detail: InstanceWorkbenchSnapshot['detail'] | null;
  managementSummary: InstanceManagementSummary | null;
  canRetryBundledStartup: boolean;
  instanceId: string | null | undefined;
  isRetryingBundledStartup: boolean;
  config: InstanceConfig | null;
  selectedAgentId: string | null;
  isWorkbenchFilesLoading: boolean;
  canEditConfigChannels: boolean;
  configChannelWorkspaceItems: ChannelWorkspaceItem[];
  readonlyChannelWorkspaceItems: ChannelWorkspaceItem[];
  configFilePath: string | null;
  selectedConfigChannelId: string | null;
  configChannelDrafts: Record<string, Record<string, string>>;
  configChannelError: string | null;
  isSavingConfigChannel: boolean;
  agentSection: React.ReactNode;
  tasksSection: React.ReactNode;
  llmProvidersSection: React.ReactNode;
  memorySection: React.ReactNode;
  toolsSection: React.ReactNode;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatWorkbenchLabel: (value: string) => string;
  getCapabilityTone: (status: string) => string;
  getRuntimeStatusTone: (status: string) => string;
  getManagementEntryTone: (tone: 'neutral' | 'success' | 'warning') => string;
  onOpenOfficialLink: (href: string) => Promise<void> | void;
  onOpenDiagnosticPath: (
    diagnostic: BundledOpenClawStartupAlertDiagnostic,
  ) => Promise<void> | void;
  onRetryBundledStartup: () => Promise<void> | void;
  onSelectedConfigChannelIdChange: (channelId: string | null) => void;
  onConfigChannelFieldChange: (fieldKey: string, value: string) => Promise<void> | void;
  onSaveConfigChannel: () => Promise<void> | void;
  onDeleteConfigChannelConfiguration: () => Promise<void> | void;
  onToggleConfigChannel: (channelId: string, nextEnabled: boolean) => Promise<void> | void;
  onSelectedAgentIdChange: (agentId: string) => void;
  onReloadFiles: () => Promise<void> | void;
  onReloadConfig: () => Promise<void> | void;
}

export function InstanceDetailSectionContent({
  activeSection,
  workbench,
  detail,
  managementSummary,
  canRetryBundledStartup,
  instanceId,
  isRetryingBundledStartup,
  config,
  selectedAgentId,
  isWorkbenchFilesLoading,
  canEditConfigChannels,
  configChannelWorkspaceItems,
  readonlyChannelWorkspaceItems,
  configFilePath,
  selectedConfigChannelId,
  configChannelDrafts,
  configChannelError,
  isSavingConfigChannel,
  agentSection,
  tasksSection,
  llmProvidersSection,
  memorySection,
  toolsSection,
  t,
  formatWorkbenchLabel,
  getCapabilityTone,
  getRuntimeStatusTone,
  getManagementEntryTone,
  onOpenOfficialLink,
  onOpenDiagnosticPath,
  onRetryBundledStartup,
  onSelectedConfigChannelIdChange,
  onConfigChannelFieldChange,
  onSaveConfigChannel,
  onDeleteConfigChannelConfiguration,
  onToggleConfigChannel,
  onSelectedAgentIdChange,
  onReloadFiles,
  onReloadConfig,
}: InstanceDetailSectionContentProps) {
  const effectiveConfigFilePath = configFilePath || workbench?.kernelConfig?.configFile || null;
  const sectionLoadingFallback = (
    <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
      {formatWorkbenchLabel('loading')}
    </div>
  );

  const renderSectionAvailability = (
    sectionId: InstanceWorkbenchSectionId,
    fallbackKey: string,
  ) =>
    renderInstanceDetailSectionAvailability({
      workbench,
      sectionId,
      fallbackKey,
      t,
      formatWorkbenchLabel,
      getCapabilityTone,
    });

  switch (activeSection) {
    case 'overview':
      if (!workbench || !detail) {
        return null;
      }
      return (
        <InstanceDetailOverviewSection
          detail={detail}
          managementSummary={managementSummary}
          canRetryBundledStartup={canRetryBundledStartup}
          isRetryingBundledStartup={isRetryingBundledStartup}
          t={t}
          formatWorkbenchLabel={formatWorkbenchLabel}
          getCapabilityTone={getCapabilityTone}
          getRuntimeStatusTone={getRuntimeStatusTone}
          getManagementEntryTone={getManagementEntryTone}
          onOpenDiagnosticPath={onOpenDiagnosticPath}
          onRetryBundledStartup={onRetryBundledStartup}
        />
      );
    case 'channels':
      if (!workbench || workbench.channels.length === 0) {
        return renderSectionAvailability('channels', 'instances.detail.instanceWorkbench.empty.channels');
      }
      return (
        <InstanceDetailChannelsSection
          items={canEditConfigChannels ? configChannelWorkspaceItems : readonlyChannelWorkspaceItems}
          canEditConfigChannels={canEditConfigChannels}
          configFilePath={effectiveConfigFilePath}
          selectedChannelId={selectedConfigChannelId}
          valuesByChannelId={configChannelDrafts}
          error={configChannelError}
          isSaving={isSavingConfigChannel}
          formatWorkbenchLabel={formatWorkbenchLabel}
          t={t}
          onOpenOfficialLink={onOpenOfficialLink}
          onSelectedChannelIdChange={onSelectedConfigChannelIdChange}
          onFieldChange={onConfigChannelFieldChange}
          onSave={onSaveConfigChannel}
          onDeleteConfiguration={onDeleteConfigChannelConfiguration}
          onToggleEnabled={onToggleConfigChannel}
        />
      );
    case 'cronTasks':
      return <>{tasksSection}</>;
    case 'llmProviders':
      return <>{llmProvidersSection}</>;
    case 'agents':
      return <>{agentSection}</>;
    case 'skills':
      if (!workbench || workbench.skills.length === 0) {
        return renderSectionAvailability('skills', 'instances.detail.instanceWorkbench.empty.skills');
      }
      return <InstanceDetailSkillsSection skills={workbench.skills} t={t} />;
    case 'files':
      return (
        <React.Suspense fallback={sectionLoadingFallback}>
          <LazyInstanceDetailFilesSection
            instanceId={instanceId ?? ''}
            config={config}
            workbench={workbench}
            detail={detail}
            selectedAgentId={selectedAgentId}
            onSelectedAgentIdChange={onSelectedAgentIdChange}
            isLoading={isWorkbenchFilesLoading}
            t={t}
            onReload={onReloadFiles}
          />
        </React.Suspense>
      );
    case 'memory':
      return <>{memorySection}</>;
    case 'tools':
      return <>{toolsSection}</>;
    case 'config':
      if (!effectiveConfigFilePath || !instanceId || !workbench) {
        return renderSectionAvailability('config', 'instances.detail.instanceWorkbench.empty.config');
      }
      return (
        <React.Suspense fallback={sectionLoadingFallback}>
          <LazyInstanceConfigWorkbenchPanel
            instanceId={instanceId}
            workbench={workbench}
            onReload={onReloadConfig}
          />
        </React.Suspense>
      );
    default:
      return null;
  }
}
