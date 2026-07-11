import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailWorkbenchChrome } from './InstanceDetailWorkbenchChrome.tsx';

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
  'InstanceDetailWorkbenchChrome renders the current summary cards, sidebar labels, and active section heading',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailWorkbenchChrome
        activeSection="tools"
        instance={{
          cpu: 38,
          memory: 61,
          totalMemory: '32 GB',
        } as any}
        workbench={{
          healthScore: 96,
          connectedChannelCount: 4,
          activeTaskCount: 2,
          readyToolCount: 7,
          agents: [{ id: 'agent-1' }, { id: 'agent-2' }],
          installedSkillCount: 9,
          sectionCounts: {
            overview: 8,
            channels: 4,
            cronTasks: 2,
            llmProviders: 3,
            agents: 2,
            skills: 9,
            files: 5,
            memory: 6,
            tools: 7,
            config: 1,
          },
        } as any}
        t={(key) => key}
        onSectionSelect={() => undefined}
      >
        <div>section-body</div>
      </InstanceDetailWorkbenchChrome>,
    );

    assert.match(markup, /data-slot="instance-workbench-sidebar"/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.summary\.healthScore/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.summary\.cpuLoad/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.sidebar\.tools/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.sections\.tools\.title/);
    assert.match(markup, /instances\.detail\.instanceWorkbench\.sections\.tools\.description/);
    assert.match(markup, /section-body/);
    assert.match(markup, />96%</);
    assert.match(markup, />32 GB</);
  },
);
