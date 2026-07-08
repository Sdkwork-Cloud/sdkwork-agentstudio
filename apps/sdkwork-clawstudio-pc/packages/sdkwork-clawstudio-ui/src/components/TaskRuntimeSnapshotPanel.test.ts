import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskRuntimeSnapshotPanel } from './TaskRuntimeSnapshotPanel.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('TaskRuntimeSnapshotPanel renders compact runtime preview boards with counts and actions', () => {
  const markup = renderToStaticMarkup(
    createElement(TaskRuntimeSnapshotPanel, {
      previewLimit: 1,
      boards: [
        {
          id: 'task-board',
          title: 'Runtime task board',
          items: [
            {
              id: 'runtime-1',
              title: 'runtime-1',
              summary: 'Queued delivery reconciliation job.',
              badges: [
                createElement('span', { key: 'status' }, 'Running'),
                createElement('span', { key: 'kind' }, 'Detached'),
              ],
              meta: createElement('span', null, 'Run ID run-1'),
              action: createElement('span', null, 'Details'),
            },
            {
              id: 'runtime-2',
              title: 'runtime-2',
              summary: 'Should be hidden from preview.',
            },
          ],
        },
        {
          id: 'flow-board',
          title: 'Task Flow board',
          items: [
            {
              id: 'flow-1',
              title: 'flow-1',
              summary: 'Waiting for approval.',
              badges: [createElement('span', { key: 'state' }, 'Blocked')],
            },
          ],
        },
      ],
    }),
  );

  assert.match(markup, /data-slot="task-runtime-snapshot-panel"/);
  assert.match(markup, /Runtime task board/);
  assert.match(markup, /Task Flow board/);
  assert.match(markup, /Queued delivery reconciliation job\./);
  assert.match(markup, /data-slot="task-runtime-snapshot-count"/);
  assert.match(markup, /data-slot="task-runtime-snapshot-item"/);
  assert.match(markup, /Details/);
  assert.doesNotMatch(markup, /Should be hidden from preview\./);
  assert.match(markup, />2</);
  assert.doesNotMatch(markup, /max-w-\[1120px\]/);
  assert.doesNotMatch(markup, /rounded-\[28px\]/);
  assert.doesNotMatch(markup, /rounded-\[24px\]/);
});

runTest('TaskRuntimeSnapshotPanel renders board messages when no preview items are available', () => {
  const markup = renderToStaticMarkup(
    createElement(TaskRuntimeSnapshotPanel, {
      boards: [
        {
          id: 'task-board',
          title: 'Runtime task board',
          count: 0,
          message: 'No detached runtime tasks have been reported yet.',
          messageTone: 'neutral',
          items: [],
        },
        {
          id: 'flow-board',
          title: 'Task Flow board',
          count: 0,
          message: 'Task Flow board unavailable.',
          messageTone: 'warning',
          items: [],
        },
      ],
    }),
  );

  assert.match(markup, /No detached runtime tasks have been reported yet\./);
  assert.match(markup, /Task Flow board unavailable\./);
  assert.match(markup, /data-slot="task-runtime-snapshot-message"/);
});
