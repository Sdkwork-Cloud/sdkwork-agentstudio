import {
  Brain,
  BriefcaseBusiness,
  Clock3,
  FileCode2,
  Files,
  Hash,
  Package,
  Server,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Instance, InstanceWorkbenchSectionId, InstanceWorkbenchSnapshot } from '../types';

export interface WorkbenchSectionDefinition {
  id: InstanceWorkbenchSectionId;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
  sectionTitleKey: string;
  sectionDescriptionKey: string;
}

export interface WorkbenchSummaryMetricDescriptor {
  id:
    | 'healthScore'
    | 'connectedChannels'
    | 'activeTasks'
    | 'readyTools'
    | 'agents'
    | 'skills';
  labelKey: string;
  value: string;
}

export interface WorkbenchResourceMetricDescriptor {
  id: 'cpuLoad' | 'memoryPressure';
  labelKey: string;
  value: string;
  detail?: string;
}

export const workbenchSections: WorkbenchSectionDefinition[] = [
  {
    id: 'overview',
    icon: Server,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.overview',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.overview',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.overview.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.overview.description',
  },
  {
    id: 'channels',
    icon: Hash,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.channels',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.channels',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.channels.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.channels.description',
  },
  {
    id: 'cronTasks',
    icon: Clock3,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.cronTasks',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.cronTasks',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.cronTasks.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.cronTasks.description',
  },
  {
    id: 'llmProviders',
    icon: Sparkles,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.llmProviders',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.llmProviders',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.llmProviders.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.llmProviders.description',
  },
  {
    id: 'agents',
    icon: BriefcaseBusiness,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.agents',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.agents',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.agents.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.agents.description',
  },
  {
    id: 'skills',
    icon: Package,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.skills',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.skills',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.skills.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.skills.description',
  },
  {
    id: 'files',
    icon: Files,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.files',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.files',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.files.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.files.description',
  },
  {
    id: 'memory',
    icon: Brain,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.memory',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.memory',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.memory.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.memory.description',
  },
  {
    id: 'tools',
    icon: Wrench,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.tools',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.tools',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.tools.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.tools.description',
  },
  {
    id: 'config',
    icon: FileCode2,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.config',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.config',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.config.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.config.description',
  },
];

export function buildInstanceWorkbenchSummaryMetrics(
  workbench: Pick<
    InstanceWorkbenchSnapshot,
    | 'healthScore'
    | 'connectedChannelCount'
    | 'activeTaskCount'
    | 'readyToolCount'
    | 'agents'
    | 'installedSkillCount'
  >,
): WorkbenchSummaryMetricDescriptor[] {
  return [
    {
      id: 'healthScore',
      labelKey: 'instances.detail.instanceWorkbench.summary.healthScore',
      value: `${workbench.healthScore}%`,
    },
    {
      id: 'connectedChannels',
      labelKey: 'instances.detail.instanceWorkbench.summary.connectedChannels',
      value: String(workbench.connectedChannelCount),
    },
    {
      id: 'activeTasks',
      labelKey: 'instances.detail.instanceWorkbench.summary.activeTasks',
      value: String(workbench.activeTaskCount),
    },
    {
      id: 'readyTools',
      labelKey: 'instances.detail.instanceWorkbench.summary.readyTools',
      value: String(workbench.readyToolCount),
    },
    {
      id: 'agents',
      labelKey: 'instances.detail.instanceWorkbench.summary.agents',
      value: String(workbench.agents.length),
    },
    {
      id: 'skills',
      labelKey: 'instances.detail.instanceWorkbench.summary.skills',
      value: String(workbench.installedSkillCount),
    },
  ];
}

export function buildInstanceWorkbenchResourceMetrics(
  instance: Pick<Instance, 'cpu' | 'memory' | 'totalMemory'>,
): WorkbenchResourceMetricDescriptor[] {
  return [
    {
      id: 'cpuLoad',
      labelKey: 'instances.detail.instanceWorkbench.summary.cpuLoad',
      value: `${instance.cpu}%`,
    },
    {
      id: 'memoryPressure',
      labelKey: 'instances.detail.instanceWorkbench.summary.memoryPressure',
      value: `${instance.memory}%`,
      detail: instance.totalMemory,
    },
  ];
}

export function getRuntimeStatusTone(status: string) {
  if (status === 'healthy') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (status === 'offline') {
    return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
}

export function getStatusBadge(status: string) {
  if (status === 'online' || status === 'connected' || status === 'active' || status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (
    status === 'starting' ||
    status === 'syncing' ||
    status === 'paused' ||
    status === 'disconnected' ||
    status === 'beta' ||
    status === 'configurationRequired'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function getDangerBadge(status: string) {
  if (
    status === 'error' ||
    status === 'failed' ||
    status === 'missing' ||
    status === 'restricted' ||
    status === 'degraded'
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return getStatusBadge(status);
}

export function getCapabilityTone(status: string) {
  if (status === 'ready') {
    return getStatusBadge(status);
  }
  if (status === 'degraded') {
    return getDangerBadge(status);
  }
  if (status === 'configurationRequired' || status === 'planned') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function getManagementEntryTone(tone: 'neutral' | 'success' | 'warning') {
  if (tone === 'success') {
    return 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10';
  }
  if (tone === 'warning') {
    return 'border-amber-200/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
  }
  return 'border-zinc-200/70 bg-zinc-950/[0.02] dark:border-zinc-800 dark:bg-white/[0.03]';
}

function getIntervalUnitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  unit: 'minute' | 'hour' | 'day',
  value: string | number,
) {
  const numericValue = Number(value);
  const suffix = numericValue === 1 ? unit : `${unit}s`;
  return t(`tasks.page.intervalUnits.${suffix}`);
}

export function buildTaskScheduleSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  task: InstanceWorkbenchSnapshot['tasks'][number],
) {
  if (task.scheduleMode === 'interval') {
    return t('tasks.page.scheduleSummary.interval', {
      value: task.scheduleConfig.intervalValue ?? '--',
      unit: getIntervalUnitLabel(
        t,
        task.scheduleConfig.intervalUnit ?? 'minute',
        task.scheduleConfig.intervalValue ?? 0,
      ),
    });
  }

  if (task.scheduleMode === 'datetime') {
    return t('tasks.page.scheduleSummary.datetime', {
      date: task.scheduleConfig.scheduledDate || '--',
      time: task.scheduleConfig.scheduledTime || '--',
    });
  }

  return task.cronExpression || task.schedule;
}
