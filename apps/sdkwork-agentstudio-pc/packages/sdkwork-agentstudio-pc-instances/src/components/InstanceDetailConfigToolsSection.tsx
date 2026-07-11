import React from 'react';
import type {
  OpenClawAuthCooldownsDraftValue,
  OpenClawWebFetchFallbackDraftValue,
  OpenClawWebFetchSharedDraftValue,
  OpenClawWebSearchNativeCodexDraftValue,
  OpenClawWebSearchProviderDraftValue,
  OpenClawWebSearchSharedDraftValue,
  OpenClawXSearchDraftValue,
} from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { InstanceDetailConfigAuthCooldownsPanel } from './InstanceDetailConfigAuthCooldownsPanel.tsx';
import { InstanceDetailConfigWebFetchPanel } from './InstanceDetailConfigWebFetchPanel.tsx';
import { InstanceDetailConfigWebSearchNativeCodexPanel } from './InstanceDetailConfigWebSearchNativeCodexPanel.tsx';
import { InstanceDetailConfigWebSearchPanel } from './InstanceDetailConfigWebSearchPanel.tsx';
import { InstanceDetailConfigXSearchPanel } from './InstanceDetailConfigXSearchPanel.tsx';
import {
  InstanceDetailToolsSection,
  type InstanceDetailToolsSectionProps,
} from './InstanceDetailToolsSection.tsx';

type ConfigWebSearchConfig = InstanceWorkbenchSnapshot['configWebSearch'];
type ConfigWebSearchProvider = NonNullable<ConfigWebSearchConfig>['providers'][number];

export interface InstanceDetailConfigToolsSectionProps {
  emptyState: React.ReactNode;
  workbench: Pick<InstanceWorkbenchSnapshot, 'tools'> | null;
  configWebSearch: ConfigWebSearchConfig;
  webSearchSharedDraft: OpenClawWebSearchSharedDraftValue | null;
  selectedWebSearchProvider: ConfigWebSearchProvider | null;
  selectedWebSearchProviderDraft: OpenClawWebSearchProviderDraftValue | null;
  webSearchError: string | null;
  isSavingWebSearch: boolean;
  canEditConfigWebSearch: boolean;
  onSaveWebSearchConfig: () => Promise<void> | void;
  onWebSearchSharedDraftChange: (
    key: keyof OpenClawWebSearchSharedDraftValue,
    value: string | boolean,
  ) => void;
  onWebSearchProviderDraftChange: (
    key: keyof OpenClawWebSearchProviderDraftValue,
    value: string,
  ) => void;
  onSelectedWebSearchProviderIdChange: (providerId: string) => void;
  configWebFetch: InstanceWorkbenchSnapshot['configWebFetch'];
  webFetchSharedDraft: OpenClawWebFetchSharedDraftValue | null;
  webFetchFallbackDraft: OpenClawWebFetchFallbackDraftValue;
  webFetchError: string | null;
  isSavingWebFetch: boolean;
  canEditConfigWebFetch: boolean;
  onSaveWebFetchConfig: () => Promise<void> | void;
  onWebFetchSharedDraftChange: (
    key: keyof OpenClawWebFetchSharedDraftValue,
    value: string | boolean,
  ) => void;
  onWebFetchFallbackDraftChange: (
    key: keyof OpenClawWebFetchFallbackDraftValue,
    value: string,
  ) => void;
  configWebSearchNativeCodex: InstanceWorkbenchSnapshot['configWebSearchNativeCodex'];
  webSearchNativeCodexDraft: OpenClawWebSearchNativeCodexDraftValue | null;
  webSearchNativeCodexError: string | null;
  isSavingWebSearchNativeCodex: boolean;
  canEditConfigWebSearchNativeCodex: boolean;
  onSaveWebSearchNativeCodexConfig: () => Promise<void> | void;
  onWebSearchNativeCodexDraftChange: (
    key: keyof OpenClawWebSearchNativeCodexDraftValue,
    value: string | boolean,
  ) => void;
  configXSearch: InstanceWorkbenchSnapshot['configXSearch'];
  xSearchDraft: OpenClawXSearchDraftValue | null;
  xSearchError: string | null;
  isSavingXSearch: boolean;
  canEditConfigXSearch: boolean;
  onSaveXSearchConfig: () => Promise<void> | void;
  onXSearchDraftChange: (
    key: keyof OpenClawXSearchDraftValue,
    value: string | boolean,
  ) => void;
  configAuthCooldowns: InstanceWorkbenchSnapshot['configAuthCooldowns'];
  authCooldownsDraft: OpenClawAuthCooldownsDraftValue | null;
  authCooldownsError: string | null;
  isSavingAuthCooldowns: boolean;
  canEditConfigAuthCooldowns: boolean;
  onSaveAuthCooldownsConfig: () => Promise<void> | void;
  onAuthCooldownsDraftChange: (
    key: keyof OpenClawAuthCooldownsDraftValue,
    value: string,
  ) => void;
  formatWorkbenchLabel: (value: string) => string;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
}

export function InstanceDetailConfigToolsSection({
  emptyState,
  workbench,
  configWebSearch,
  webSearchSharedDraft,
  selectedWebSearchProvider,
  selectedWebSearchProviderDraft,
  webSearchError,
  isSavingWebSearch,
  canEditConfigWebSearch,
  onSaveWebSearchConfig,
  onWebSearchSharedDraftChange,
  onWebSearchProviderDraftChange,
  onSelectedWebSearchProviderIdChange,
  configWebFetch,
  webFetchSharedDraft,
  webFetchFallbackDraft,
  webFetchError,
  isSavingWebFetch,
  canEditConfigWebFetch,
  onSaveWebFetchConfig,
  onWebFetchSharedDraftChange,
  onWebFetchFallbackDraftChange,
  configWebSearchNativeCodex,
  webSearchNativeCodexDraft,
  webSearchNativeCodexError,
  isSavingWebSearchNativeCodex,
  canEditConfigWebSearchNativeCodex,
  onSaveWebSearchNativeCodexConfig,
  onWebSearchNativeCodexDraftChange,
  configXSearch,
  xSearchDraft,
  xSearchError,
  isSavingXSearch,
  canEditConfigXSearch,
  onSaveXSearchConfig,
  onXSearchDraftChange,
  configAuthCooldowns,
  authCooldownsDraft,
  authCooldownsError,
  isSavingAuthCooldowns,
  canEditConfigAuthCooldowns,
  onSaveAuthCooldownsConfig,
  onAuthCooldownsDraftChange,
  formatWorkbenchLabel,
  getDangerBadge,
  getStatusBadge,
  t,
}: InstanceDetailConfigToolsSectionProps) {
  const configWebSearchPanel =
    configWebSearch &&
    webSearchSharedDraft &&
    selectedWebSearchProvider &&
    selectedWebSearchProviderDraft ? (
      <InstanceDetailConfigWebSearchPanel
        configWebSearch={configWebSearch}
        webSearchSharedDraft={webSearchSharedDraft}
        selectedWebSearchProvider={selectedWebSearchProvider}
        selectedWebSearchProviderDraft={selectedWebSearchProviderDraft}
        webSearchError={webSearchError}
        isSavingWebSearch={isSavingWebSearch}
        canEditConfigWebSearch={canEditConfigWebSearch}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveWebSearchConfig}
        onWebSearchSharedDraftChange={onWebSearchSharedDraftChange}
        onWebSearchProviderDraftChange={onWebSearchProviderDraftChange}
        onSelectedWebSearchProviderIdChange={onSelectedWebSearchProviderIdChange}
      />
    ) : null;

  const configWebFetchPanel =
    configWebFetch && webFetchSharedDraft ? (
      <InstanceDetailConfigWebFetchPanel
        configWebFetch={configWebFetch}
        webFetchSharedDraft={webFetchSharedDraft}
        webFetchFallbackDraft={webFetchFallbackDraft}
        webFetchError={webFetchError}
        isSavingWebFetch={isSavingWebFetch}
        canEditConfigWebFetch={canEditConfigWebFetch}
        t={t}
        onSave={onSaveWebFetchConfig}
        onWebFetchSharedDraftChange={onWebFetchSharedDraftChange}
        onWebFetchFallbackDraftChange={onWebFetchFallbackDraftChange}
      />
    ) : null;

  const configWebSearchNativeCodexPanel =
    configWebSearchNativeCodex && webSearchNativeCodexDraft ? (
      <InstanceDetailConfigWebSearchNativeCodexPanel
        webSearchNativeCodexDraft={webSearchNativeCodexDraft}
        webSearchNativeCodexError={webSearchNativeCodexError}
        isSavingWebSearchNativeCodex={isSavingWebSearchNativeCodex}
        canEditConfigWebSearchNativeCodex={canEditConfigWebSearchNativeCodex}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveWebSearchNativeCodexConfig}
        onDraftChange={onWebSearchNativeCodexDraftChange}
      />
    ) : null;

  const configXSearchPanel =
    configXSearch && xSearchDraft ? (
      <InstanceDetailConfigXSearchPanel
        xSearchDraft={xSearchDraft}
        xSearchError={xSearchError}
        isSavingXSearch={isSavingXSearch}
        canEditConfigXSearch={canEditConfigXSearch}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveXSearchConfig}
        onDraftChange={onXSearchDraftChange}
      />
    ) : null;

  const configAuthCooldownsPanel =
    configAuthCooldowns && authCooldownsDraft ? (
      <InstanceDetailConfigAuthCooldownsPanel
        authCooldownsDraft={authCooldownsDraft}
        authCooldownsError={authCooldownsError}
        isSavingAuthCooldowns={isSavingAuthCooldowns}
        canEditConfigAuthCooldowns={canEditConfigAuthCooldowns}
        formatWorkbenchLabel={formatWorkbenchLabel}
        t={t}
        onSave={onSaveAuthCooldownsConfig}
        onDraftChange={onAuthCooldownsDraftChange}
      />
    ) : null;

  const sectionProps: Omit<InstanceDetailToolsSectionProps, 'hasRuntimeTools' | 'emptyState'> = {
    configAuthCooldownsPanel,
    configWebSearchPanel,
    configWebSearchNativeCodexPanel,
    configXSearchPanel,
    configWebFetchPanel,
    tools: workbench?.tools || [],
    getDangerBadge,
    getStatusBadge,
    t,
  };

  const hasRuntimeTools = sectionProps.tools.length > 0;
  const hasAnyToolsSurface = Boolean(
    hasRuntimeTools ||
      sectionProps.configAuthCooldownsPanel ||
      sectionProps.configWebSearchPanel ||
      sectionProps.configWebSearchNativeCodexPanel ||
      sectionProps.configXSearchPanel ||
      sectionProps.configWebFetchPanel,
  );

  if (!hasAnyToolsSurface) {
    return <>{emptyState}</>;
  }

  return (
    <InstanceDetailToolsSection
      {...sectionProps}
      hasRuntimeTools={hasRuntimeTools}
      emptyState={emptyState}
    />
  );
}
