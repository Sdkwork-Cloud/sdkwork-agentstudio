import React from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@sdkwork/claw-ui';
import type { InstanceLLMProviderUpdate, InstanceWorkbenchSnapshot } from '../types/index.ts';
import { InstanceLLMConfigPanel } from './InstanceLLMConfigPanel.tsx';

type InstanceWorkbenchLlmProvider = InstanceWorkbenchSnapshot['llmProviders'][number];
type InstanceWorkbenchLlmProviderModel = InstanceWorkbenchLlmProvider['models'][number];

export interface InstanceDetailLlmProvidersSectionProps {
  providers: InstanceWorkbenchSnapshot['llmProviders'];
  selectedProvider: InstanceWorkbenchLlmProvider | null;
  selectedProviderDraft: InstanceLLMProviderUpdate | null;
  selectedProviderRequestDraft: string;
  selectedProviderRequestParseError: string | null;
  hasPendingProviderChanges: boolean;
  isSavingProviderConfig: boolean;
  isProviderConfigReadonly: boolean;
  isOpenClawConfigWritable: boolean;
  canManageOpenClawProviders: boolean;
  configFilePath: string | null;
  availabilityNotice: React.ReactNode;
  formatWorkbenchLabel: (value: string) => string;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
  onOpenProviderCenter: () => void;
  onOpenCreateProviderDialog: () => void;
  onSelectProvider: (providerId: string) => void;
  onRequestDeleteProvider: (providerId: string) => void;
  onFieldChange: (
    field: 'endpoint' | 'apiKeySource' | 'defaultModelId' | 'reasoningModelId' | 'embeddingModelId',
    value: string,
  ) => void;
  onRequestOverridesChange: (value: string) => void;
  onConfigChange: (
    field: keyof InstanceLLMProviderUpdate['config'],
    value: number | boolean,
  ) => void;
  onReset: () => void;
  onSave: () => Promise<void> | void;
  onOpenCreateProviderModelDialog: () => void;
  onOpenEditProviderModelDialog: (model: InstanceWorkbenchLlmProviderModel) => void;
  onRequestDeleteProviderModel: (modelId: string) => void;
}

export function InstanceDetailLlmProvidersSection({
  providers,
  selectedProvider,
  selectedProviderDraft,
  selectedProviderRequestDraft,
  selectedProviderRequestParseError,
  hasPendingProviderChanges,
  isSavingProviderConfig,
  isProviderConfigReadonly,
  isOpenClawConfigWritable,
  canManageOpenClawProviders,
  configFilePath,
  availabilityNotice,
  formatWorkbenchLabel,
  getDangerBadge,
  getStatusBadge,
  t,
  onOpenProviderCenter,
  onOpenCreateProviderDialog,
  onSelectProvider,
  onRequestDeleteProvider,
  onFieldChange,
  onRequestOverridesChange,
  onConfigChange,
  onReset,
  onSave,
  onOpenCreateProviderModelDialog,
  onOpenEditProviderModelDialog,
  onRequestDeleteProviderModel,
}: InstanceDetailLlmProvidersSectionProps) {
  const hasProviders = providers.length > 0;
  const providerWorkspaceDescription = isProviderConfigReadonly ? t('instances.detail.instanceWorkbench.llmProviders.readonlyNotice') : t('instances.detail.instanceWorkbench.llmProviders.panel.description');
  const providerWorkspaceActionLabel = isProviderConfigReadonly ? t('providerCenter.page.title') : t('instances.detail.instanceWorkbench.llmProviders.panel.newProvider');

  return (
    <div data-slot="instance-detail-llm-providers" className="space-y-6">
      <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {t('instances.detail.instanceWorkbench.llmProviders.panel.badge')}
              </span>
              {configFilePath ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  {t('instances.detail.instanceWorkbench.llmProviders.panel.configFile')}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {providerWorkspaceDescription}
            </p>
            {configFilePath ? (
              <div className="mt-4 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 text-xs text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  {formatWorkbenchLabel('configFile')}
                </div>
                <div className="mt-1 break-all font-mono">{configFilePath}</div>
              </div>
            ) : null}
          </div>
          <Button
            onClick={isProviderConfigReadonly ? onOpenProviderCenter : onOpenCreateProviderDialog}
            disabled={isProviderConfigReadonly ? false : !canManageOpenClawProviders}
            className="rounded-2xl px-4 py-3"
          >
            <Plus className="h-4 w-4" />
            {providerWorkspaceActionLabel}
          </Button>
        </div>
      </div>

      {!hasProviders && !isOpenClawConfigWritable ? (
        availabilityNotice
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <div data-slot="instance-llm-provider-list" className="space-y-4">
            {!hasProviders ? (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/35">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.llmProviders.panel.emptyTitle')}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.llmProviders.panel.emptyDescription')}
                </p>
              </div>
            ) : (
              providers.map((providerRecord) => {
                const isActive = selectedProvider?.id === providerRecord.id;
                const defaultModel =
                  providerRecord.models.find((model) => model.id === providerRecord.defaultModelId) ||
                  null;

                return (
                  <div
                    key={providerRecord.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectProvider(providerRecord.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectProvider(providerRecord.id);
                      }
                    }}
                    className={`rounded-[1.5rem] border p-5 transition-colors ${
                      isActive
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                        : 'border-zinc-200/70 bg-white/80 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                            isActive
                              ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                              : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          }`}
                        >
                          {providerRecord.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-tight">{providerRecord.name}</h3>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                providerRecord.status === 'degraded'
                                  ? getDangerBadge('degraded')
                                  : getStatusBadge(providerRecord.status)
                              }`}
                            >
                              {t(`instances.detail.instanceWorkbench.llmProviders.status.${providerRecord.status}`)}
                            </span>
                          </div>
                          <p
                            className={`mt-2 text-sm leading-6 ${
                              isActive
                                ? 'text-white/75 dark:text-zinc-700'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {providerRecord.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectProvider(providerRecord.id);
                          onRequestDeleteProvider(providerRecord.id);
                        }}
                        disabled={!canManageOpenClawProviders}
                        className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('common.delete')}
                      </Button>
                    </div>
                    <div
                      className={`mt-4 rounded-2xl px-4 py-3 font-mono text-sm ${
                        isActive
                          ? 'bg-white/10 text-white/80 dark:bg-zinc-950/10 dark:text-zinc-700'
                          : 'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
                      }`}
                    >
                      {providerRecord.endpoint || '--'}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <div>
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {t('instances.detail.instanceWorkbench.llmProviders.panel.defaultShort')}
                        </div>
                        <div
                          className={`mt-1 text-sm font-medium ${
                            isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                          }`}
                        >
                          {defaultModel?.name || '--'}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {t('instances.detail.instanceWorkbench.llmProviders.panel.models')}
                        </div>
                        <div
                          className={`mt-1 text-sm font-medium ${
                            isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                          }`}
                        >
                          {providerRecord.models.length}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {t('instances.detail.instanceWorkbench.llmProviders.temperature')}
                        </div>
                        <div
                          className={`mt-1 text-sm font-medium ${
                            isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                          }`}
                        >
                          {providerRecord.config.temperature}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
                        </div>
                        <div
                          className={`mt-1 text-sm font-medium ${
                            isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                          }`}
                        >
                          {providerRecord.config.streaming
                            ? t('instances.detail.instanceWorkbench.llmProviders.on')
                            : t('instances.detail.instanceWorkbench.llmProviders.off')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            <InstanceLLMConfigPanel
              provider={selectedProvider}
              draft={selectedProviderDraft}
              hasPendingChanges={hasPendingProviderChanges}
              isSaving={isSavingProviderConfig}
              isReadonly={isProviderConfigReadonly}
              readonlyMessage={t('instances.detail.instanceWorkbench.llmProviders.readonlyNotice')}
              onOpenProviderCenter={onOpenProviderCenter}
              openProviderCenterLabel={t('providerCenter.page.title')}
              requestOverridesText={selectedProviderRequestDraft}
              requestOverridesError={selectedProviderRequestParseError}
              onFieldChange={onFieldChange}
              onRequestOverridesChange={onRequestOverridesChange}
              onConfigChange={onConfigChange}
              onReset={onReset}
              onSave={onSave}
            />
            <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.llmProviders.panel.providerModelsTitle')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.llmProviders.panel.providerModelsDescription')}
                  </p>
                </div>
                <Button
                  onClick={onOpenCreateProviderModelDialog}
                  disabled={!selectedProvider || !canManageOpenClawProviders}
                  className="rounded-2xl px-4 py-3"
                >
                  <Plus className="h-4 w-4" />
                  {t('instances.detail.instanceWorkbench.llmProviders.panel.addModel')}
                </Button>
              </div>
              {!selectedProvider ? (
                <div className="mt-5 rounded-2xl bg-zinc-950/[0.04] px-4 py-5 text-sm text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.llmProviders.panel.selectProvider')}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {selectedProvider.models.map((model) => (
                    <div
                      key={model.id}
                      className="rounded-2xl border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {model.name}
                            </h4>
                            <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                              {t(`instances.detail.instanceWorkbench.llmProviders.modelRoles.${model.role}`)}
                            </span>
                          </div>
                          <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {model.id}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => onOpenEditProviderModelDialog(model)}
                            disabled={!canManageOpenClawProviders}
                            className="rounded-2xl px-3 py-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => onRequestDeleteProviderModel(model.id)}
                            disabled={!canManageOpenClawProviders}
                            className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
