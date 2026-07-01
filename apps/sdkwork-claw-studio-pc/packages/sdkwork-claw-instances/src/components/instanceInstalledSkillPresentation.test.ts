import assert from 'node:assert/strict';
import type { Skill } from '@sdkwork/claw-types';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

let instanceInstalledSkillPresentationModule:
  | typeof import('./instanceInstalledSkillPresentation.ts')
  | undefined;

try {
  instanceInstalledSkillPresentationModule = await import('./instanceInstalledSkillPresentation.ts');
} catch {
  instanceInstalledSkillPresentationModule = undefined;
}

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Workflow Guard',
    description: 'Guards workflow execution.',
    author: 'SDKWork',
    rating: 4.8,
    downloads: 42,
    category: 'Automation',
    version: '1.4.0',
    size: undefined,
    updatedAt: undefined,
    readme: undefined,
    repositoryUrl: undefined,
    homepageUrl: undefined,
    documentationUrl: undefined,
    instanceAsset: undefined,
    ...overrides,
  };
}

function translate(key: string, options?: Record<string, unknown>) {
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.unknownSource') {
    return 'Unknown source';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.fieldLabels.status') {
    return 'Runtime status';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.fieldLabels.source') {
    return 'Source';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.fieldLabels.scope') {
    return 'Scope';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.fieldLabels.missingRequirements') {
    return 'Missing requirements';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.status.enabled') {
    return 'Enabled';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.status.disabled') {
    return 'Disabled';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.status.blocked') {
    return 'Blocked';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.compatibility.compatible') {
    return 'Compatible';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.compatibility.attention') {
    return 'Needs attention';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.compatibility.blocked') {
    return 'Blocked';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.scope.workspace') {
    return 'Workspace';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.scope.managed') {
    return 'Shared';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.scope.bundled') {
    return 'Bundled';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.scope.unknown') {
    return 'External';
  }
  if (key === 'instances.detail.instanceWorkbench.skills.runtime.missingRequirementsValue') {
    return `Missing ${options?.count ?? 0} requirements`;
  }

  return key;
}

await runTest(
  'instanceInstalledSkillPresentation exposes installed-skill runtime presentation helpers',
  () => {
    assert.ok(
      instanceInstalledSkillPresentationModule,
      'Expected instanceInstalledSkillPresentation.ts to exist',
    );
    assert.equal(
      typeof instanceInstalledSkillPresentationModule?.createInstanceInstalledSkillPresentationCopy,
      'function',
    );
    assert.equal(
      typeof instanceInstalledSkillPresentationModule?.buildInstanceInstalledSkillInformation,
      'function',
    );
  },
);

await runTest(
  'buildInstanceInstalledSkillInformation returns runtime compatibility details for instance skills',
  () => {
    const copy =
      instanceInstalledSkillPresentationModule?.createInstanceInstalledSkillPresentationCopy(translate);
    const information = instanceInstalledSkillPresentationModule?.buildInstanceInstalledSkillInformation(
      createSkill({
        instanceAsset: {
          source: 'managed',
          scope: 'managed',
          status: 'disabled',
          compatibility: 'attention',
          bundled: false,
          missingRequirementCount: 2,
        },
      }),
      copy!,
    );

    assert.deepEqual(information, {
      compatibilityValue: 'Needs attention',
      rows: [
        {
          id: 'status',
          label: 'Runtime status',
          value: 'Disabled',
        },
        {
          id: 'source',
          label: 'Source',
          value: 'managed',
        },
        {
          id: 'scope',
          label: 'Scope',
          value: 'Shared',
        },
        {
          id: 'missingRequirements',
          label: 'Missing requirements',
          value: 'Missing 2 requirements',
        },
      ],
    });
  },
);

await runTest(
  'buildInstanceInstalledSkillInformation falls back cleanly when runtime metadata is missing',
  () => {
    const copy =
      instanceInstalledSkillPresentationModule?.createInstanceInstalledSkillPresentationCopy(translate);
    const information = instanceInstalledSkillPresentationModule?.buildInstanceInstalledSkillInformation(
      createSkill(),
      copy!,
    );

    assert.deepEqual(information, {
      compatibilityValue: null,
      rows: [],
    });
  },
);
