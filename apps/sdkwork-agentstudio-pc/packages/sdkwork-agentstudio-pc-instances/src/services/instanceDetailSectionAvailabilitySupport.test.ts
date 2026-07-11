import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

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

async function loadInstanceDetailSectionAvailabilitySupportModule() {
  const moduleUrl = new URL('./instanceDetailSectionAvailabilitySupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailSectionAvailabilitySupport.ts to exist',
  );

  return import('./instanceDetailSectionAvailabilitySupport.ts');
}

await runTest(
  'createInstanceDetailSectionAvailabilityRenderer pre-binds page-owned availability context for each requested section',
  async () => {
    const { createInstanceDetailSectionAvailabilityRenderer } =
      await loadInstanceDetailSectionAvailabilitySupportModule();
    const calls: any[] = [];

    const renderSectionAvailability = createInstanceDetailSectionAvailabilityRenderer({
      workbench: {
        sectionAvailability: {
          llmProviders: {
            status: 'ready',
            detail: '',
          },
        },
      } as any,
      t: (key: string) => `translated:${key}`,
      formatWorkbenchLabel: (value: string) => `label:${value}`,
      getCapabilityTone: (value: string) => `tone:${value}`,
      renderAvailability: (args) => {
        calls.push(args);
        return `rendered:${args.sectionId}:${args.fallbackKey}`;
      },
    });

    const providerNotice = renderSectionAvailability(
      'llmProviders',
      'instances.detail.instanceWorkbench.empty.llmProviders',
    );
    const memoryNotice = renderSectionAvailability(
      'memory',
      'instances.detail.instanceWorkbench.empty.memory',
    );

    assert.equal(
      providerNotice,
      'rendered:llmProviders:instances.detail.instanceWorkbench.empty.llmProviders',
    );
    assert.equal(
      memoryNotice,
      'rendered:memory:instances.detail.instanceWorkbench.empty.memory',
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[0].t('x'), 'translated:x');
    assert.equal(calls[0].formatWorkbenchLabel('ready'), 'label:ready');
    assert.equal(calls[0].getCapabilityTone('ready'), 'tone:ready');
    assert.equal(calls[0].workbench.sectionAvailability.llmProviders.status, 'ready');
    assert.equal(calls[1].sectionId, 'memory');
  },
);
