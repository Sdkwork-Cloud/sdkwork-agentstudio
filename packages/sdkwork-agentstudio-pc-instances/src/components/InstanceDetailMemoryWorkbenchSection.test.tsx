import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailMemoryWorkbenchSection } from './InstanceDetailMemoryWorkbenchSection.tsx';

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

await runTest(
  'InstanceDetailMemoryWorkbenchSection composes the dreaming workspace from page-owned state instead of requiring prebuilt section props',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailMemoryWorkbenchSection
        isLoading={false}
        emptyState={<div>empty-memory</div>}
        loadingLabel="loading"
        workbench={{
          memories: [
            {
              id: 'memory-1',
              title: 'Dream diary',
              updatedAt: '2026-04-09T10:30:00.000Z',
            },
          ],
        } as any}
        memoryWorkbenchState={{
          isEmpty: false,
          hasMemoryEntries: true,
          dreamDiaryEntries: [{ updatedAt: '2026-04-09T10:30:00.000Z' }],
        }}
        configDreaming={{ enabled: true } as any}
        dreamingDraft={{
          enabled: true,
          frequency: 'daily',
          model: '',
          systemPrompt: '',
          prompt: '',
          retentionDays: '',
          maxMemories: '',
          summaryModel: '',
        } as any}
        dreamingError={null}
        isSavingDreaming={false}
        canEditDreamingConfig
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
        onDreamingDraftChange={() => undefined}
        onSaveDreamingConfig={() => undefined}
      />,
    );

    assert.match(markup, /data-slot="instance-detail-memory"/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.dreaming\.title/);
    assert.match(markup, /2026-04-09T10:30:00\.000Z/);
    assert.doesNotMatch(markup, /empty-memory/);
  },
);
