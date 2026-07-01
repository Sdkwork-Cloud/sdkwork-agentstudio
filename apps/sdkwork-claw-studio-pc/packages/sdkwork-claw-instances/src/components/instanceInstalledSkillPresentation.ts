import type {
  Skill,
  SkillInstanceAssetCompatibility,
  SkillInstanceAssetScope,
  SkillInstanceAssetStatus,
} from '@sdkwork/claw-types';

export interface InstanceInstalledSkillPresentationCopy {
  unknownSourceLabel: string;
  fieldLabels: {
    status: string;
    source: string;
    scope: string;
    missingRequirements: string;
  };
  statusLabels: Record<SkillInstanceAssetStatus, string>;
  compatibilityLabels: Record<SkillInstanceAssetCompatibility, string>;
  scopeLabels: Record<SkillInstanceAssetScope, string>;
  formatMissingRequirements: (count: number) => string;
}

export interface InstanceInstalledSkillInformationRow {
  id: 'status' | 'source' | 'scope' | 'missingRequirements';
  label: string;
  value: string;
}

export interface InstanceInstalledSkillInformation {
  compatibilityValue: string | null;
  rows: InstanceInstalledSkillInformationRow[];
}

function getSourceValue(
  skill: Skill,
  copy: InstanceInstalledSkillPresentationCopy,
) {
  const source = skill.instanceAsset?.source?.trim();
  if (!source || source.toLowerCase() === 'unknown') {
    return copy.unknownSourceLabel;
  }

  return source;
}

export function buildInstanceInstalledSkillInformation(
  skill: Skill,
  copy: InstanceInstalledSkillPresentationCopy,
): InstanceInstalledSkillInformation {
  const asset = skill.instanceAsset;
  if (!asset) {
    return {
      compatibilityValue: null,
      rows: [],
    };
  }

  const rows: InstanceInstalledSkillInformationRow[] = [
    {
      id: 'status',
      label: copy.fieldLabels.status,
      value: copy.statusLabels[asset.status],
    },
    {
      id: 'source',
      label: copy.fieldLabels.source,
      value: getSourceValue(skill, copy),
    },
    {
      id: 'scope',
      label: copy.fieldLabels.scope,
      value: copy.scopeLabels[asset.scope],
    },
  ];

  if (asset.missingRequirementCount > 0) {
    rows.push({
      id: 'missingRequirements',
      label: copy.fieldLabels.missingRequirements,
      value: copy.formatMissingRequirements(asset.missingRequirementCount),
    });
  }

  return {
    compatibilityValue: copy.compatibilityLabels[asset.compatibility],
    rows,
  };
}

export function createInstanceInstalledSkillPresentationCopy(
  t: (key: string, options?: Record<string, unknown>) => string,
): InstanceInstalledSkillPresentationCopy {
  return {
    unknownSourceLabel: t('instances.detail.instanceWorkbench.skills.runtime.unknownSource'),
    fieldLabels: {
      status: t('instances.detail.instanceWorkbench.skills.runtime.fieldLabels.status'),
      source: t('instances.detail.instanceWorkbench.skills.runtime.fieldLabels.source'),
      scope: t('instances.detail.instanceWorkbench.skills.runtime.fieldLabels.scope'),
      missingRequirements: t(
        'instances.detail.instanceWorkbench.skills.runtime.fieldLabels.missingRequirements',
      ),
    },
    statusLabels: {
      enabled: t('instances.detail.instanceWorkbench.skills.runtime.status.enabled'),
      disabled: t('instances.detail.instanceWorkbench.skills.runtime.status.disabled'),
      blocked: t('instances.detail.instanceWorkbench.skills.runtime.status.blocked'),
    },
    compatibilityLabels: {
      compatible: t('instances.detail.instanceWorkbench.skills.runtime.compatibility.compatible'),
      attention: t('instances.detail.instanceWorkbench.skills.runtime.compatibility.attention'),
      blocked: t('instances.detail.instanceWorkbench.skills.runtime.compatibility.blocked'),
    },
    scopeLabels: {
      workspace: t('instances.detail.instanceWorkbench.skills.runtime.scope.workspace'),
      managed: t('instances.detail.instanceWorkbench.skills.runtime.scope.managed'),
      bundled: t('instances.detail.instanceWorkbench.skills.runtime.scope.bundled'),
      unknown: t('instances.detail.instanceWorkbench.skills.runtime.scope.unknown'),
    },
    formatMissingRequirements: (count) =>
      t('instances.detail.instanceWorkbench.skills.runtime.missingRequirementsValue', { count }),
  };
}
