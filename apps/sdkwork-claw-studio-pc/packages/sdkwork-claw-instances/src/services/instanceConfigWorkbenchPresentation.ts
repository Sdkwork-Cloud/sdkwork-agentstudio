import type {
  InstanceConfigWorkbenchSectionDescriptor,
  InstanceConfigWorkbenchModel,
  InstanceConfigWorkbenchSectionCategoryId,
} from './instanceConfigWorkbench.ts';

const CATEGORY_ORDER: InstanceConfigWorkbenchSectionCategoryId[] = [
  'core',
  'ai',
  'communication',
  'automation',
  'infrastructure',
  'appearance',
  'other',
];

export interface InstanceConfigWorkbenchCategoryGroup {
  id: InstanceConfigWorkbenchSectionCategoryId;
  sectionCount: number;
  sections: InstanceConfigWorkbenchPresentableSection[];
  firstSection: InstanceConfigWorkbenchPresentableSection | null;
}

export type InstanceConfigWorkbenchPresentableSection = Pick<
  InstanceConfigWorkbenchSectionDescriptor,
  'key' | 'label' | 'description' | 'category'
>;

export type InstanceConfigOverviewMetricId =
  | 'configFile'
  | 'defaultAgent'
  | 'defaultModel'
  | 'sessions'
  | 'providers'
  | 'agents'
  | 'channels'
  | 'sections'
  | 'customSections'
  | 'formCoverage'
  | 'schemaVersion'
  | 'schemaGenerated'
  | 'rawLines'
  | 'writable';

export interface InstanceConfigOverviewMetric {
  id: InstanceConfigOverviewMetricId;
  value: string;
}

export function groupInstanceConfigSectionsByCategory(
  sections: InstanceConfigWorkbenchPresentableSection[],
): InstanceConfigWorkbenchCategoryGroup[] {
  const sectionsByCategory = new Map<
    InstanceConfigWorkbenchSectionCategoryId,
    InstanceConfigWorkbenchPresentableSection[]
  >();

  CATEGORY_ORDER.forEach((categoryId) => {
    sectionsByCategory.set(categoryId, []);
  });

  sections.forEach((section) => {
    const bucket = sectionsByCategory.get(section.category);
    if (bucket) {
      bucket.push(section);
    }
  });

  return CATEGORY_ORDER.map((categoryId) => {
    const groupedSections = sectionsByCategory.get(categoryId) || [];
    return {
      id: categoryId,
      sectionCount: groupedSections.length,
      sections: groupedSections,
      firstSection: groupedSections[0] || null,
    };
  }).filter((entry) => entry.sectionCount > 0);
}

export function buildInstanceConfigOverviewMetrics(params: {
  document: InstanceConfigWorkbenchModel['document'];
  configSections: InstanceConfigWorkbenchPresentableSection[];
  structuredEditorCoverage: string;
  schemaVersionLabel: string;
  schemaGeneratedAtLabel: string;
}): InstanceConfigOverviewMetric[] {
  const customSectionCount = params.configSections.filter(
    (section) => section.category === 'other',
  ).length;

  return [
    {
      id: 'configFile',
      value: params.document.configFile || 'openclaw.json',
    },
    {
      id: 'defaultAgent',
      value: params.document.defaultAgentId || 'Not configured',
    },
    {
      id: 'defaultModel',
      value: params.document.defaultModelRef || 'Not configured',
    },
    {
      id: 'sessions',
      value: params.document.sessionsVisibility || 'Not configured',
    },
    {
      id: 'providers',
      value: String(params.document.providerCount),
    },
    {
      id: 'agents',
      value: String(params.document.agentCount),
    },
    {
      id: 'channels',
      value: String(params.document.channelCount),
    },
    {
      id: 'sections',
      value: String(params.configSections.length),
    },
    {
      id: 'customSections',
      value: String(customSectionCount),
    },
    {
      id: 'formCoverage',
      value: params.structuredEditorCoverage,
    },
    {
      id: 'schemaVersion',
      value: params.schemaVersionLabel,
    },
    {
      id: 'schemaGenerated',
      value: params.schemaGeneratedAtLabel,
    },
    {
      id: 'rawLines',
      value: String(params.document.rawLineCount),
    },
    {
      id: 'writable',
      value: params.document.isWritable ? 'Yes' : 'No',
    },
  ];
}
