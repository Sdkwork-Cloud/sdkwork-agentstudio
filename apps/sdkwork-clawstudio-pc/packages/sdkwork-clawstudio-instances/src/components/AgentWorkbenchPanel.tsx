import { useMemo, useState } from 'react';
import { Copy, Edit2, Package, Plus, Trash2, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@sdkwork/clawstudio-ui';
import {
  buildOpenClawAgentParamEntries,
  type AgentWorkbenchSnapshot,
} from '../services';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { InstanceFilesWorkspace } from './InstanceFilesWorkspace';

interface AgentWorkbenchPanelProps {
  workbench: InstanceWorkbenchSnapshot;
  snapshot: AgentWorkbenchSnapshot | null;
  errorMessage?: string | null;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
  onOpenAgentCreationWorkflow: () => void;
  onEditAgent: (agent: InstanceWorkbenchSnapshot['agents'][number]) => void;
  onDeleteAgent: (agentId: string) => void;
  onInstallSkill: (slug: string) => void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => void;
  isReadonly: boolean;
  isLoading: boolean;
  isFilesLoading: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
  onReload: () => Promise<void> | void;
}

type AgentWorkbenchTabId =
  | 'overview'
  | 'channels'
  | 'tasks'
  | 'skills'
  | 'tools'
  | 'files';

function getTone(status: string) {
  if (status === 'bound' || status === 'ready' || status === 'connected') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'available' || status === 'degraded') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function formatStatus(status: string, translate: (key: string) => string) {
  const labels: Record<string, string> = {
    bound: translate('instances.detail.instanceWorkbench.agents.status.bound'),
    available: translate('instances.detail.instanceWorkbench.agents.status.available'),
    notConfigured: translate('instances.detail.instanceWorkbench.agents.status.notConfigured'),
    ready: translate('instances.detail.instanceWorkbench.agents.status.ready'),
    connected: translate('instances.detail.instanceWorkbench.agents.status.connected'),
    degraded: translate('instances.detail.instanceWorkbench.agents.status.degraded'),
    configurationRequired: translate(
      'instances.detail.instanceWorkbench.agents.status.configurationRequired',
    ),
    active: translate('instances.detail.instanceWorkbench.agents.status.active'),
    paused: translate('instances.detail.instanceWorkbench.agents.status.paused'),
    running: translate('instances.detail.instanceWorkbench.agents.status.running'),
    failed: translate('instances.detail.instanceWorkbench.agents.status.failed'),
    disconnected: translate('instances.detail.instanceWorkbench.agents.status.disconnected'),
  };
  return labels[status] || status;
}

function formatSourceLabel(
  source: 'agent' | 'defaults' | 'runtime',
  translate: (key: string) => string,
) {
  return translate(`instances.detail.instanceWorkbench.agents.modelSources.${source}`);
}

function formatAgentParamLabel(
  key: 'temperature' | 'topP' | 'maxTokens' | 'timeoutMs' | 'streaming',
  translate: (key: string) => string,
) {
  if (key === 'temperature') {
    return translate('instances.detail.instanceWorkbench.llmProviders.temperature');
  }
  if (key === 'topP') {
    return translate('instances.detail.instanceWorkbench.llmProviders.topP');
  }
  if (key === 'maxTokens') {
    return translate('instances.detail.instanceWorkbench.llmProviders.maxTokens');
  }
  if (key === 'timeoutMs') {
    return translate('instances.detail.instanceWorkbench.llmProviders.timeoutMs');
  }
  return translate('instances.detail.instanceWorkbench.llmProviders.streaming');
}

function formatAgentParamValue(
  key: 'temperature' | 'topP' | 'maxTokens' | 'timeoutMs' | 'streaming',
  value: string,
  translate: (key: string) => string,
) {
  if (key === 'streaming') {
    return value === 'true'
      ? translate('instances.detail.instanceWorkbench.state.enabled')
      : translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
  }

  return value;
}

function formatSkillScope(
  scope: NonNullable<AgentWorkbenchSnapshot['skills'][number]>['scope'],
  translate: (key: string) => string,
) {
  if (scope === 'workspace') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.workspace');
  }
  if (scope === 'managed') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.managed');
  }
  if (scope === 'bundled') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.bundled');
  }
  return translate('instances.detail.instanceWorkbench.agents.skillScopes.unknown');
}

function buildSkillInstallCommand(workspacePath?: string | null, slug?: string) {
  const target = workspacePath?.trim() || '.';
  const normalizedSlug = slug?.trim() || '<skill-slug>';
  return `cd "${target}"\nopenclaw skills install ${normalizedSlug}`;
}

function summarizeMissingRequirements(
  missing: AgentWorkbenchSnapshot['skills'][number]['missing'],
  translate: (key: string) => string,
) {
  const parts: string[] = [];
  if (missing.env.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementEnv')}: ${missing.env.join(', ')}`,
    );
  }
  if (missing.bins.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementBins')}: ${missing.bins.join(', ')}`,
    );
  }
  if (missing.anyBins.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementAnyBin')}: ${missing.anyBins.join(', ')}`,
    );
  }
  if (missing.config.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementConfig')}: ${missing.config.join(', ')}`,
    );
  }

  return parts.join(' / ');
}

export function AgentWorkbenchPanel({
  workbench,
  snapshot,
  errorMessage,
  selectedAgentId,
  onSelectedAgentIdChange,
  onOpenAgentCreationWorkflow,
  onEditAgent,
  onDeleteAgent,
  onInstallSkill,
  onSetSkillEnabled,
  onRemoveSkill,
  isReadonly,
  isLoading,
  isFilesLoading,
  isInstallingSkill,
  updatingSkillKeys,
  removingSkillKeys,
  onReload,
}: AgentWorkbenchPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AgentWorkbenchTabId>('overview');
  const [skillInstallSlug, setSkillInstallSlug] = useState('');
  const [copiedCommandKey, setCopiedCommandKey] = useState<string | null>(null);

  const selectedAgentRecord = useMemo(
    () => workbench.agents.find((agent) => agent.agent.id === selectedAgentId) || null,
    [selectedAgentId, workbench.agents],
  );
  const boundChannelCount = snapshot?.channels.filter((channel) => channel.routeStatus === 'bound').length || 0;
  const skillInstallCommand = useMemo(
    () => buildSkillInstallCommand(snapshot?.paths.workspacePath, skillInstallSlug),
    [skillInstallSlug, snapshot?.paths.workspacePath],
  );
  const skillsDirectoryPath =
    snapshot?.paths.skillsDirectoryPath || `${snapshot?.paths.workspacePath || '.'}/skills`;
  const canInstallSelectedAgentSkill =
    Boolean(snapshot?.agent.isDefault) && !isReadonly && skillInstallSlug.trim().length > 0;
  const showDirectInstallNotice = snapshot ? !snapshot.agent.isDefault : false;

  const handleCopyCommand = async (key: string, command: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(command);
    setCopiedCommandKey(key);
    window.setTimeout(() => {
      setCopiedCommandKey((current) => (current === key ? null : current));
    }, 1600);
  };

  const topTabs = snapshot
    ? [
        {
          id: 'overview' as const,
          label: t('instances.detail.instanceWorkbench.sidebar.overview'),
        },
        {
          id: 'channels' as const,
          label: t('instances.detail.instanceWorkbench.sections.channels.title'),
          count: snapshot.channels.length,
        },
        {
          id: 'tasks' as const,
          label: t('instances.detail.instanceWorkbench.sections.cronTasks.title'),
          count: snapshot.tasks.length,
        },
        {
          id: 'skills' as const,
          label: t('instances.detail.instanceWorkbench.sections.skills.title'),
          count: snapshot.skills.length,
        },
        {
          id: 'tools' as const,
          label: t('instances.detail.instanceWorkbench.sections.tools.title'),
          count: snapshot.tools.length,
        },
        {
          id: 'files' as const,
          label: t('instances.detail.instanceWorkbench.sections.files.title'),
          count: snapshot.files.length,
        },
      ]
    : [];

  const renderOverviewTab = () => {
    if (!snapshot) {
      return null;
    }

    const paramEntries = buildOpenClawAgentParamEntries(snapshot.agent);

    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.sections.llmProviders.title')}
          </h4>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.3rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.primaryModel')}
                </div>
                <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {snapshot.model.primary ||
                    t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                </div>
              </div>
              <div className="rounded-[1.3rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.fallbackModels')}
                </div>
                <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {snapshot.model.fallbacks.length ? snapshot.model.fallbacks.join(', ') : t('common.none')}
                </div>
              </div>
            </div>
            <div className="rounded-[1.3rem] border border-zinc-200/70 bg-white/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.agents.panel.effectiveParams')}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {paramEntries.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {paramEntries.length > 0 ? (
                  paramEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="rounded-[1.2rem] bg-zinc-950/[0.03] px-4 py-3 dark:bg-white/[0.04]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {formatAgentParamLabel(entry.key, t)}
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${getTone(entry.source === 'agent' ? 'bound' : entry.source === 'defaults' ? 'available' : 'notConfigured')}`}
                        >
                          {formatSourceLabel(entry.source, t)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatAgentParamValue(entry.key, entry.value, t)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400 md:col-span-2">
                    {t('common.none')}
                  </div>
                )}
              </div>
            </div>
            {snapshot.modelProviders.length > 0 ? (
              snapshot.modelProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-[1.3rem] border border-zinc-200/70 bg-white/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {provider.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {provider.endpoint}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(provider.status)}`}
                    >
                      {formatStatus(provider.status, t)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.empty.llmProviders')}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.agents.panel.pathsTitle')}
          </h4>
          <div className="mt-5 grid gap-3">
            {[
              {
                label: t('instances.detail.instanceWorkbench.agents.panel.workspace'),
                value: snapshot.paths.workspacePath,
              },
              {
                label: t('instances.detail.instanceWorkbench.agents.panel.skillsDirectory'),
                value: snapshot.paths.skillsDirectoryPath,
              },
              {
                label: t('instances.detail.instanceWorkbench.agents.panel.agentDir'),
                value: snapshot.paths.agentDirPath,
              },
              { label: 'auth-profiles.json', value: snapshot.paths.authProfilesPath },
              { label: 'models.json', value: snapshot.paths.modelsRegistryPath },
              {
                label: t('instances.detail.instanceWorkbench.agents.panel.sessions'),
                value: snapshot.paths.sessionsPath,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.25rem] bg-zinc-950/[0.03] px-4 py-3 dark:bg-white/[0.04]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {item.value || '--'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderChannelsTab = () => {
    if (!snapshot) {
      return null;
    }

    return (
      <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('instances.detail.instanceWorkbench.sections.channels.title')}
        </h4>
        <div className="mt-5 grid gap-3">
          {snapshot.channels.map((channel) => (
            <div
              key={channel.id}
              className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {channel.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {channel.description}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(channel.routeStatus)}`}
                >
                  {formatStatus(channel.routeStatus, t)}
                </span>
              </div>
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.boundAccounts')}:{' '}
                {channel.accountIds.length ? channel.accountIds.join(', ') : '--'}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.availableAccounts')}:{' '}
                {channel.availableAccountIds.length
                  ? channel.availableAccountIds.join(', ')
                  : channel.configurationMode === 'none'
                    ? t('instances.detail.instanceWorkbench.agents.panel.builtIn')
                    : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTasksTab = () => {
    if (!snapshot) {
      return null;
    }

    return (
      <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('instances.detail.instanceWorkbench.sections.cronTasks.title')}
        </h4>
        <div className="mt-5 grid gap-3">
          {snapshot.tasks.length > 0 ? (
            snapshot.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {task.name}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {task.schedule}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(task.status)}`}
                  >
                    {formatStatus(task.status, t)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.empty.cronTasks')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSkillsTab = () => {
    if (!snapshot) {
      return null;
    }

    return (
      <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('instances.detail.instanceWorkbench.sections.skills.title')}
        </h4>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-[1.3rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.workspaceInstallCommand')}
                </div>
                <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.workspaceInstallDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCommand('agent-skill-install', skillInstallCommand)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                title={copiedCommandKey === 'agent-skill-install' ? t('common.copied') : t('common.copy')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <Input
                value={skillInstallSlug}
                onChange={(event) => setSkillInstallSlug(event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.agents.panel.skillSlugPlaceholder')}
                className="flex-1"
              />
              <Button
                onClick={() => onInstallSkill(skillInstallSlug.trim())}
                disabled={!canInstallSelectedAgentSkill || isInstallingSkill}
                className="rounded-2xl px-4 py-3"
              >
                {isInstallingSkill
                  ? t('common.loading')
                  : t('instances.detail.instanceWorkbench.agents.panel.installToDefaultWorkspace')}
              </Button>
            </div>
            {showDirectInstallNotice ? (
              <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                {t('instances.detail.instanceWorkbench.agents.panel.defaultWorkspaceOnlyNotice')}
              </div>
            ) : null}
            <div className="mt-3 rounded-2xl bg-zinc-950 px-3 py-3 font-mono text-xs text-zinc-100 dark:bg-black">
              {skillInstallCommand}
            </div>
          </div>

          <div className="rounded-[1.3rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.panel.skillPaths')}
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {t('instances.detail.instanceWorkbench.agents.panel.agentWorkspace')}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  {skillsDirectoryPath}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {t('instances.detail.instanceWorkbench.agents.panel.sharedSkills')}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.sharedSkillsDefaultPath')}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {snapshot.skills.length > 0 ? (
            snapshot.skills.map((skill) => (
              <div
                key={skill.id}
                className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {skill.name}
                        </div>
                        <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                          {formatSkillScope(skill.scope, t)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(skill.disabled ? 'notConfigured' : skill.eligible ? 'ready' : 'degraded')}`}
                        >
                          {skill.disabled
                            ? t('instances.detail.instanceWorkbench.agents.skillStates.disabled')
                            : skill.eligible
                              ? t('instances.detail.instanceWorkbench.agents.skillStates.ready')
                              : t('instances.detail.instanceWorkbench.agents.skillStates.needsSetup')}
                        </span>
                      </div>
                      {!isReadonly ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => onSetSkillEnabled(skill.skillKey, skill.disabled)}
                            disabled={
                              updatingSkillKeys.includes(skill.skillKey) ||
                              removingSkillKeys.includes(skill.skillKey)
                            }
                            className="rounded-2xl px-3 py-2"
                          >
                            {updatingSkillKeys.includes(skill.skillKey)
                              ? t('common.loading')
                              : skill.disabled
                                ? t('instances.detail.instanceWorkbench.agents.panel.enableSkill')
                                : t('instances.detail.instanceWorkbench.agents.panel.disableSkill')}
                          </Button>
                          {skill.scope === 'workspace' ? (
                            <Button
                              variant="outline"
                              onClick={() => onRemoveSkill(skill)}
                              disabled={removingSkillKeys.includes(skill.skillKey)}
                              className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                            >
                              {removingSkillKeys.includes(skill.skillKey)
                                ? t('common.loading')
                                : t('common.uninstall')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {skill.skillKey}
                      {skill.version ? ` / v${skill.version}` : ''}
                    </div>
                    <div className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                      {skill.description}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('instances.detail.instanceWorkbench.agents.panel.source')}
                        </div>
                        <div className="mt-1 break-all text-xs text-zinc-900 dark:text-zinc-100">
                          {skill.filePath || skill.source}
                        </div>
                      </div>
                      <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('instances.detail.instanceWorkbench.agents.panel.primaryEnv')}
                        </div>
                        <div className="mt-1 break-all text-xs text-zinc-900 dark:text-zinc-100">
                          {skill.primaryEnv || t('common.none')}
                        </div>
                      </div>
                    </div>
                    {skill.installOptions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {skill.installOptions.map((option) => (
                          <span
                            key={`${skill.id}-${option.id}`}
                            className="rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                          >
                            {option.kind}: {option.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {summarizeMissingRequirements(skill.missing, t) ? (
                      <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        {t('instances.detail.instanceWorkbench.agents.panel.missingPrefix')}:{' '}
                        {summarizeMissingRequirements(skill.missing, t)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.empty.skills')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderToolsTab = () => {
    if (!snapshot) {
      return null;
    }

    return (
      <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t('instances.detail.instanceWorkbench.sections.tools.title')}
        </h4>
        <div className="mt-5 grid gap-3">
          {snapshot.tools.length > 0 ? (
            snapshot.tools.map((tool) => (
              <div
                key={tool.id}
                className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {tool.name}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(tool.status)}`}
                      >
                        {formatStatus(tool.status, t)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {tool.description}
                    </div>
                    <div className="mt-3 rounded-2xl bg-zinc-950/[0.03] px-3 py-3 font-mono text-xs text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-300">
                      {tool.command}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.empty.tools')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFilesTab = () => {
    if (!snapshot) {
      return null;
    }

    return (
      <div data-slot="agent-workbench-files">
        <InstanceFilesWorkspace
          mode="agent"
          instanceId={workbench.instance.id}
          files={snapshot.files}
          agent={snapshot.agent}
          runtimeKind={workbench.detail.instance.runtimeKind}
          transportKind={workbench.detail.instance.transportKind}
          isBuiltIn={workbench.detail.instance.isBuiltIn}
          isLoading={isFilesLoading}
          onReload={onReload}
        />
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'channels':
        return renderChannelsTab();
      case 'tasks':
        return renderTasksTab();
      case 'skills':
        return renderSkillsTab();
      case 'tools':
        return renderToolsTab();
      case 'files':
        return renderFilesTab();
      default:
        return null;
    }
  };

  if (workbench.agents.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
        {t('instances.detail.instanceWorkbench.empty.agents')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {t('instances.detail.instanceWorkbench.agents.panel.badge')}
              </span>
              {workbench.kernelConfig?.configFile ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  {t('instances.detail.instanceWorkbench.agents.panel.configFile')}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionPrefix')}
              <span className="mx-1 font-mono text-xs">
                {t('instances.detail.instanceWorkbench.agents.panel.authProfilesFile')}
              </span>
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionMiddle')}
              <span className="mx-1 font-mono text-xs">
                {t('instances.detail.instanceWorkbench.agents.panel.agentDirInline')}
              </span>
              {t('instances.detail.instanceWorkbench.agents.panel.descriptionSuffix')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={onOpenAgentCreationWorkflow}
              disabled={isReadonly}
              className="rounded-2xl px-4 py-3"
            >
              <Plus className="h-4 w-4" />
              {t('instances.detail.instanceWorkbench.agents.panel.newAgent')}
            </Button>
          </div>
        </div>
        {isReadonly ? (
          <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.agents.marketReadonlyNotice')}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside data-slot="agent-workbench-sidebar" className="space-y-3 rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
          {workbench.agents.map((agentRecord) => {
            const isActive = agentRecord.agent.id === selectedAgentId;
            return (
              <button
                key={agentRecord.agent.id}
                type="button"
                onClick={() => onSelectedAgentIdChange(agentRecord.agent.id)}
                className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition-colors ${
                  isActive
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                    : 'border-zinc-200/70 bg-zinc-50/80 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${isActive ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950' : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'}`}>
                    {agentRecord.agent.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{agentRecord.agent.name}</div>
                    <div className={`mt-1 truncate text-xs ${isActive ? 'text-white/75 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {agentRecord.model?.primary || t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                    </div>
                    <div className={`mt-2 text-[11px] ${isActive ? 'text-white/70 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {agentRecord.focusAreas.join(' / ')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        <div data-slot="agent-workbench-detail" className="space-y-6">
          {isLoading || !snapshot || !selectedAgentRecord ? (
            <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
              {isLoading ? (
                t('common.loading')
              ) : errorMessage ? (
                <div className="space-y-2">
                  <div className="font-medium text-rose-600 dark:text-rose-300">
                    {errorMessage}
                  </div>
                  <div>{t('instances.detail.instanceWorkbench.empty.agents')}</div>
                </div>
              ) : (
                t('instances.detail.instanceWorkbench.empty.agents')
              )}
            </div>
          ) : (
            <>
              <div className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/35">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-sky-500/10 text-2xl text-sky-600 dark:text-sky-300">
                      {snapshot.agent.agent.avatar}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{snapshot.agent.agent.name}</h3>
                        {snapshot.agent.isDefault ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                            {t('instances.detail.instanceWorkbench.agents.panel.defaultBadge')}
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(snapshot.model.source === 'agent' ? 'bound' : snapshot.model.source === 'defaults' ? 'available' : 'notConfigured')}`}>
                          {formatSourceLabel(snapshot.model.source, t)}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{snapshot.agent.agent.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {snapshot.agent.focusAreas.map((focusArea) => (
                          <span key={focusArea} className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                            {focusArea}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => onEditAgent(selectedAgentRecord)} disabled={isReadonly} className="rounded-2xl px-4 py-3">
                      <Edit2 className="h-4 w-4" />
                      {t('common.edit')}
                    </Button>
                    <Button variant="outline" onClick={() => onDeleteAgent(snapshot.agent.agent.id)} disabled={isReadonly} className="rounded-2xl px-4 py-3 text-rose-600 hover:text-rose-600 dark:text-rose-300">
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: t('instances.detail.instanceWorkbench.metrics.automationFitScore'), value: `${snapshot.agent.automationFitScore}%` },
                    { label: t('instances.detail.instanceWorkbench.sections.channels.title'), value: boundChannelCount },
                    { label: t('instances.detail.instanceWorkbench.sections.skills.title'), value: snapshot.skills.length },
                    { label: t('instances.detail.instanceWorkbench.sections.cronTasks.title'), value: snapshot.tasks.length },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-[1.35rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{metric.label}</div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <section className="flex flex-wrap gap-2" data-slot="agent-workbench-top-tabs">
                {topTabs.map((tab) => {
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-300'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {'count' in tab ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isActive
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {tab.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </section>

              {renderActiveTab()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
