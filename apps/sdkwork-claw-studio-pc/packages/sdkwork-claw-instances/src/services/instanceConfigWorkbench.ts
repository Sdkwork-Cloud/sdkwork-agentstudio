import {
  analyzeOpenClawConfigDocument,
  parseOpenClawConfigDocument,
  resolveAttachedKernelConfigFile,
} from '@sdkwork/claw-core';
import type { InstanceKernelConfigInsights } from '../types/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';
import { buildKernelConfigProjection } from './kernelConfigProjection.ts';

export type InstanceConfigWorkbenchModeId = 'config' | 'raw';

export interface InstanceConfigWorkbenchMode {
  id: InstanceConfigWorkbenchModeId;
  label: string;
}

export type InstanceConfigWorkbenchSectionCategoryId =
  | 'core'
  | 'ai'
  | 'communication'
  | 'automation'
  | 'infrastructure'
  | 'appearance'
  | 'other';

export interface InstanceConfigWorkbenchSection {
  key: string;
  label: string;
  title: string;
  description: string;
  category: InstanceConfigWorkbenchSectionCategoryId;
  kind: 'object' | 'array' | 'scalar';
  entryCount: number;
  fieldNames: string[];
  formattedValue: string;
  preview: string;
  isKnownSection: boolean;
}

export interface InstanceConfigWorkbenchSectionDescriptor {
  key: string;
  label: string;
  title: string;
  description: string;
  category: InstanceConfigWorkbenchSectionCategoryId;
  isKnownSection: boolean;
}

export interface InstanceConfigWorkbenchCategorySummary {
  id: InstanceConfigWorkbenchSectionCategoryId;
  label: string;
  sectionCount: number;
  keys: string[];
}

export interface InstanceConfigWorkbenchModel {
  document: {
    configFile: string | null;
    isWritable: boolean;
    defaultAgentId: string | null;
    defaultModelRef: string | null;
    sessionsVisibility: InstanceKernelConfigInsights['sessionsVisibility'];
    providerCount: number;
    agentCount: number;
    channelCount: number;
    sectionCount: number;
    customSectionCount: number;
    rawLineCount: number;
  };
  sections: InstanceConfigWorkbenchSection[];
  categories: InstanceConfigWorkbenchCategorySummary[];
  raw: {
    content: string;
    lineCount: number;
    characterCount: number;
    sectionCount: number;
    parseError: string | null;
  };
}

export interface InstanceConfigWorkbenchDiffEntry {
  path: string;
  sectionKey: string;
  kind: 'added' | 'removed' | 'changed';
  before: unknown;
  after: unknown;
}

export interface InstanceConfigWorkbenchDiff {
  parseError: string | null;
  entries: InstanceConfigWorkbenchDiffEntry[];
}

interface InstanceConfigWorkbenchSectionDefinition {
  key: string;
  label: string;
  title?: string;
  description: string;
  category: InstanceConfigWorkbenchSectionCategoryId;
}

const INSTANCE_CONFIG_WORKBENCH_MODES: InstanceConfigWorkbenchMode[] = [
  { id: 'config', label: 'Config' },
  { id: 'raw', label: 'Raw' },
];

const SECTION_CATEGORY_META: Array<{
  id: Exclude<InstanceConfigWorkbenchSectionCategoryId, 'other'>;
  label: string;
  sections: Array<Pick<InstanceConfigWorkbenchSectionDefinition, 'key' | 'label'>>;
}> = [
  {
    id: 'core',
    label: 'Core',
    sections: [
      { key: 'env', label: 'Environment' },
      { key: 'auth', label: 'Authentication' },
      { key: 'update', label: 'Updates' },
      { key: 'meta', label: 'Meta' },
      { key: 'logging', label: 'Logging' },
      { key: 'diagnostics', label: 'Diagnostics' },
      { key: 'cli', label: 'Cli' },
      { key: 'secrets', label: 'Secrets' },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Agents',
    sections: [
      { key: 'agents', label: 'Agents' },
      { key: 'models', label: 'Models' },
      { key: 'skills', label: 'Skills' },
      { key: 'tools', label: 'Tools' },
      { key: 'memory', label: 'Memory' },
      { key: 'session', label: 'Session' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    sections: [
      { key: 'channels', label: 'Channels' },
      { key: 'messages', label: 'Messages' },
      { key: 'broadcast', label: 'Broadcast' },
      { key: 'talk', label: 'Talk' },
      { key: 'audio', label: 'Audio' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    sections: [
      { key: 'commands', label: 'Commands' },
      { key: 'hooks', label: 'Hooks' },
      { key: 'bindings', label: 'Bindings' },
      { key: 'cron', label: 'Cron' },
      { key: 'approvals', label: 'Approvals' },
      { key: 'plugins', label: 'Plugins' },
    ],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    sections: [
      { key: 'gateway', label: 'Gateway' },
      { key: 'web', label: 'Web' },
      { key: 'browser', label: 'Browser' },
      { key: 'nodeHost', label: 'NodeHost' },
      { key: 'canvasHost', label: 'CanvasHost' },
      { key: 'discovery', label: 'Discovery' },
      { key: 'media', label: 'Media' },
      { key: 'acp', label: 'Acp' },
      { key: 'mcp', label: 'Mcp' },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    sections: [
      { key: '__appearance__', label: 'Theme' },
      { key: 'ui', label: 'UI' },
      { key: 'wizard', label: 'Setup Wizard' },
    ],
  },
];

const SECTION_DEFINITION_LOOKUP = new Map<string, InstanceConfigWorkbenchSectionDefinition>([
  [
    'env',
    {
      key: 'env',
      label: 'Environment',
      title: 'Environment Variables',
      description: 'Environment variables passed to the gateway process',
      category: 'core',
    },
  ],
  [
    'auth',
    {
      key: 'auth',
      label: 'Authentication',
      description: 'API keys and authentication profiles',
      category: 'core',
    },
  ],
  [
    'update',
    {
      key: 'update',
      label: 'Updates',
      description: 'Auto-update settings and release channel',
      category: 'core',
    },
  ],
  [
    'meta',
    {
      key: 'meta',
      label: 'Meta',
      title: 'Metadata',
      description: 'Gateway metadata and version information',
      category: 'core',
    },
  ],
  [
    'logging',
    {
      key: 'logging',
      label: 'Logging',
      description: 'Log levels and output configuration',
      category: 'core',
    },
  ],
  [
    'diagnostics',
    {
      key: 'diagnostics',
      label: 'Diagnostics',
      description: 'Instrumentation, OpenTelemetry, and cache-trace settings',
      category: 'core',
    },
  ],
  [
    'cli',
    {
      key: 'cli',
      label: 'Cli',
      title: 'CLI',
      description: 'CLI banner and startup behavior',
      category: 'core',
    },
  ],
  [
    'secrets',
    {
      key: 'secrets',
      label: 'Secrets',
      description: 'Secret provider configuration',
      category: 'core',
    },
  ],
  [
    'agents',
    {
      key: 'agents',
      label: 'Agents',
      description: 'Agent configurations, models, and identities',
      category: 'ai',
    },
  ],
  [
    'models',
    {
      key: 'models',
      label: 'Models',
      description: 'AI model configurations and providers',
      category: 'ai',
    },
  ],
  [
    'skills',
    {
      key: 'skills',
      label: 'Skills',
      description: 'Skill packs and capabilities',
      category: 'ai',
    },
  ],
  [
    'tools',
    {
      key: 'tools',
      label: 'Tools',
      description: 'Tool configurations (browser, search, etc.)',
      category: 'ai',
    },
  ],
  [
    'memory',
    {
      key: 'memory',
      label: 'Memory',
      description: 'Memory retention and persistence settings',
      category: 'ai',
    },
  ],
  [
    'session',
    {
      key: 'session',
      label: 'Session',
      description: 'Session management and persistence',
      category: 'ai',
    },
  ],
  [
    'channels',
    {
      key: 'channels',
      label: 'Channels',
      description: 'Messaging channels (Telegram, Discord, Slack, etc.)',
      category: 'communication',
    },
  ],
  [
    'messages',
    {
      key: 'messages',
      label: 'Messages',
      description: 'Message handling and routing settings',
      category: 'communication',
    },
  ],
  [
    'broadcast',
    {
      key: 'broadcast',
      label: 'Broadcast',
      description: 'Broadcast and notification settings',
      category: 'communication',
    },
  ],
  [
    'talk',
    {
      key: 'talk',
      label: 'Talk',
      description: 'Voice and speech settings',
      category: 'communication',
    },
  ],
  [
    'audio',
    {
      key: 'audio',
      label: 'Audio',
      description: 'Audio input/output settings',
      category: 'communication',
    },
  ],
  [
    'commands',
    {
      key: 'commands',
      label: 'Commands',
      description: 'Custom slash commands',
      category: 'automation',
    },
  ],
  [
    'hooks',
    {
      key: 'hooks',
      label: 'Hooks',
      description: 'Webhooks and event hooks',
      category: 'automation',
    },
  ],
  [
    'bindings',
    {
      key: 'bindings',
      label: 'Bindings',
      description: 'Key bindings and shortcuts',
      category: 'automation',
    },
  ],
  [
    'cron',
    {
      key: 'cron',
      label: 'Cron',
      description: 'Scheduled tasks and automation',
      category: 'automation',
    },
  ],
  [
    'approvals',
    {
      key: 'approvals',
      label: 'Approvals',
      description: 'Approval policies and workflow gates',
      category: 'automation',
    },
  ],
  [
    'plugins',
    {
      key: 'plugins',
      label: 'Plugins',
      description: 'Plugin management and extensions',
      category: 'automation',
    },
  ],
  [
    'gateway',
    {
      key: 'gateway',
      label: 'Gateway',
      description: 'Gateway server settings (port, auth, binding)',
      category: 'infrastructure',
    },
  ],
  [
    'web',
    {
      key: 'web',
      label: 'Web',
      description: 'Web server and API settings',
      category: 'infrastructure',
    },
  ],
  [
    'browser',
    {
      key: 'browser',
      label: 'Browser',
      description: 'Browser automation settings',
      category: 'infrastructure',
    },
  ],
  [
    'nodeHost',
    {
      key: 'nodeHost',
      label: 'NodeHost',
      title: 'Node Host',
      description: 'Node host runtime settings',
      category: 'infrastructure',
    },
  ],
  [
    'canvasHost',
    {
      key: 'canvasHost',
      label: 'CanvasHost',
      title: 'Canvas Host',
      description: 'Canvas rendering and display',
      category: 'infrastructure',
    },
  ],
  [
    'discovery',
    {
      key: 'discovery',
      label: 'Discovery',
      description: 'Service discovery and networking',
      category: 'infrastructure',
    },
  ],
  [
    'media',
    {
      key: 'media',
      label: 'Media',
      description: 'Media pipeline and attachment configuration',
      category: 'infrastructure',
    },
  ],
  [
    'acp',
    {
      key: 'acp',
      label: 'Acp',
      title: 'ACP',
      description: 'Agent Communication Protocol runtime and streaming settings',
      category: 'infrastructure',
    },
  ],
  [
    'mcp',
    {
      key: 'mcp',
      label: 'Mcp',
      title: 'MCP',
      description: 'Model Context Protocol server definitions',
      category: 'infrastructure',
    },
  ],
  [
    '__appearance__',
    {
      key: '__appearance__',
      label: 'Theme',
      description: 'Theme, color, and visual appearance configuration',
      category: 'appearance',
    },
  ],
  [
    'ui',
    {
      key: 'ui',
      label: 'UI',
      description: 'User interface preferences',
      category: 'appearance',
    },
  ],
  [
    'wizard',
    {
      key: 'wizard',
      label: 'Setup Wizard',
      description: 'Setup wizard state and history',
      category: 'appearance',
    },
  ],
]);

const SECTION_ORDER = new Map<string, number>();
SECTION_CATEGORY_META.forEach((category, categoryIndex) => {
  category.sections.forEach((section, sectionIndex) => {
    SECTION_ORDER.set(section.key, categoryIndex * 100 + sectionIndex);
  });
});

function countDocumentLines(rawDocument: string) {
  if (!rawDocument) {
    return 1;
  }

  return rawDocument.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

function compareSections(
  a: Pick<InstanceConfigWorkbenchSectionDescriptor, 'key' | 'label' | 'isKnownSection'>,
  b: Pick<InstanceConfigWorkbenchSectionDescriptor, 'key' | 'label' | 'isKnownSection'>,
) {
  const orderA = SECTION_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER;
  const orderB = SECTION_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  if (a.isKnownSection !== b.isKnownSection) {
    return a.isKnownSection ? -1 : 1;
  }

  return a.label.localeCompare(b.label);
}

function compareDiffEntries(a: InstanceConfigWorkbenchDiffEntry, b: InstanceConfigWorkbenchDiffEntry) {
  const orderA = SECTION_ORDER.get(a.sectionKey) ?? Number.MAX_SAFE_INTEGER;
  const orderB = SECTION_ORDER.get(b.sectionKey) ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a.path.localeCompare(b.path);
}

function collectConfigDiffEntries(params: {
  before: unknown;
  after: unknown;
  path: string;
  sectionKey: string;
  entries: InstanceConfigWorkbenchDiffEntry[];
}) {
  const { before, after, path, sectionKey, entries } = params;

  if (before === after) {
    return;
  }

  if (before === undefined) {
    entries.push({ path, sectionKey, kind: 'added', before, after });
    return;
  }

  if (after === undefined) {
    entries.push({ path, sectionKey, kind: 'removed', before, after });
    return;
  }

  if (typeof before !== typeof after) {
    entries.push({ path, sectionKey, kind: 'changed', before, after });
    return;
  }

  if (
    typeof before !== 'object' ||
    before === null ||
    after === null ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      entries.push({ path, sectionKey, kind: 'changed', before, after });
    }
    return;
  }

  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const allKeys = Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const key of allKeys) {
    collectConfigDiffEntries({
      before: beforeRecord[key],
      after: afterRecord[key],
      path: path ? `${path}.${key}` : key,
      sectionKey,
      entries,
    });
  }
}

function humanizeSectionKey(key: string) {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Custom Section';
  }

  return normalized
    .split(/\s+/)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(' ');
}

function createCustomSectionDefinition(key: string): InstanceConfigWorkbenchSectionDefinition {
  return {
    key,
    label: humanizeSectionKey(key),
    title: humanizeSectionKey(key),
    description: 'Custom top-level section detected in openclaw.json.',
    category: 'other',
  };
}

export function buildInstanceConfigWorkbenchSectionDescriptors(
  keys: string[],
): InstanceConfigWorkbenchSectionDescriptor[] {
  return [...new Set(keys)]
    .map((key) => {
      const definition = SECTION_DEFINITION_LOOKUP.get(key) || createCustomSectionDefinition(key);
      return {
        key,
        label: definition.label,
        title: definition.title ?? definition.label,
        description: definition.description,
        category: definition.category,
        isKnownSection: SECTION_DEFINITION_LOOKUP.has(key),
      };
    })
    .sort(compareSections);
}

function buildCategorySummaries(sections: InstanceConfigWorkbenchSection[]) {
  const categories = new Map<InstanceConfigWorkbenchSectionCategoryId, InstanceConfigWorkbenchCategorySummary>();

  SECTION_CATEGORY_META.forEach((category) => {
    categories.set(category.id, {
      id: category.id,
      label: category.label,
      sectionCount: 0,
      keys: [],
    });
  });
  categories.set('other', {
    id: 'other',
    label: 'Other',
    sectionCount: 0,
    keys: [],
  });

  sections.forEach((section) => {
    const summary = categories.get(section.category);
    if (!summary) {
      return;
    }
    summary.sectionCount += 1;
    summary.keys.push(section.key);
  });

  return [
    ...SECTION_CATEGORY_META.map((category) => categories.get(category.id)!),
    categories.get('other')!,
  ];
}

export function getInstanceConfigWorkbenchModes() {
  return INSTANCE_CONFIG_WORKBENCH_MODES.map((mode) => ({ ...mode }));
}

export function computeInstanceConfigWorkbenchDiff(
  previousRawDocument: string,
  nextRawDocument: string,
): InstanceConfigWorkbenchDiff {
  const previousParsed = parseOpenClawConfigDocument(previousRawDocument);
  const nextParsed = parseOpenClawConfigDocument(nextRawDocument);
  const parseError = previousParsed.parseError || nextParsed.parseError;

  if (parseError || !previousParsed.parsed || !nextParsed.parsed) {
    return {
      parseError: parseError || 'Unable to parse config documents.',
      entries: [],
    };
  }

  const entries: InstanceConfigWorkbenchDiffEntry[] = [];
  const allSections = Array.from(
    new Set([...Object.keys(previousParsed.parsed), ...Object.keys(nextParsed.parsed)]),
  ).sort((a, b) => {
    const orderA = SECTION_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
    const orderB = SECTION_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.localeCompare(b);
  });

  for (const sectionKey of allSections) {
    collectConfigDiffEntries({
      before: previousParsed.parsed[sectionKey],
      after: nextParsed.parsed[sectionKey],
      path: sectionKey,
      sectionKey,
      entries,
    });
  }

  return {
    parseError: null,
    entries: entries.sort(compareDiffEntries),
  };
}

export function buildInstanceConfigWorkbenchModel(input: {
  workbench: InstanceWorkbenchSnapshot;
  rawDocument: string;
}): InstanceConfigWorkbenchModel {
  const { workbench, rawDocument } = input;
  const kernelConfig =
    workbench.kernelConfig ||
    buildKernelConfigProjection({
      runtimeKind: workbench.detail.instance.runtimeKind,
      deploymentMode: workbench.detail.instance.deploymentMode,
      isBuiltIn: workbench.detail.instance.isBuiltIn,
      configFile: resolveAttachedKernelConfigFile(workbench.detail),
      workspacePath:
        workbench.detail.config.workspacePath || workbench.detail.instance.config.workspacePath || null,
      configWritable: workbench.detail.lifecycle.configWritable,
      schemaVersion: null,
    });
  const kernelAuthority =
    workbench.kernelAuthority || buildKernelAuthorityProjection(workbench.detail);
  const configChannels = workbench.configChannels || [];
  const kernelConfigInsights = workbench.kernelConfigInsights || null;
  const rawAnalysis = analyzeOpenClawConfigDocument(rawDocument);
  const descriptors = buildInstanceConfigWorkbenchSectionDescriptors(
    rawAnalysis.sections.map((section) => section.key),
  );
  const sections = descriptors.map((descriptor) => {
    const section = rawAnalysis.sections.find((entry) => entry.key === descriptor.key)!;
    return {
      ...section,
      ...descriptor,
    };
  });

  return {
    document: {
      configFile: kernelConfig?.configFile || null,
      isWritable: Boolean(kernelConfig?.writable && kernelAuthority?.configControl),
      defaultAgentId: kernelConfigInsights?.defaultAgentId || null,
      defaultModelRef: kernelConfigInsights?.defaultModelRef || null,
      sessionsVisibility: kernelConfigInsights?.sessionsVisibility || null,
      providerCount: workbench.llmProviders.length,
      agentCount: workbench.agents.length,
      channelCount: configChannels.length,
      sectionCount: sections.length,
      customSectionCount: sections.filter((section) => section.category === 'other').length,
      rawLineCount: countDocumentLines(rawDocument),
    },
    sections,
    categories: buildCategorySummaries(sections),
    raw: {
      content: rawDocument,
      lineCount: countDocumentLines(rawDocument),
      characterCount: rawDocument.length,
      sectionCount: sections.length,
      parseError: rawAnalysis.parseError,
    },
  };
}
