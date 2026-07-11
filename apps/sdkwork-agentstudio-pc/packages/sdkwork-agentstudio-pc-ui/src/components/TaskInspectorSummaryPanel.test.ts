import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskInspectorSummaryPanel } from './TaskInspectorSummaryPanel.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('TaskInspectorSummaryPanel splits overview, timeline, error, and advanced fields', () => {
  const markup = renderToStaticMarkup(
    createElement(TaskInspectorSummaryPanel, {
      identity: 'runtime-1',
      badges: [
        createElement('span', { key: 'status' }, 'Running'),
        createElement('span', { key: 'kind' }, 'Detached'),
      ],
      summary: 'Queued delivery reconciliation job.',
      secondarySummary: 'Optional secondary title',
      overviewItems: [
        { label: 'Run ID', value: 'run-1' },
        { label: 'Owner', value: 'ops' },
      ],
      timelineItems: [
        { label: 'Started', value: '2026-04-17T08:00:00.000Z' },
        { label: 'Finished', value: '-' },
      ],
      error: 'Rate limit exceeded',
      advancedLabel: 'Details',
      advancedItems: [
        { label: 'Notify', value: 'webhook' },
        { label: 'Flow ID', value: 'flow-1' },
      ],
    }),
  );

  assert.match(markup, /data-slot="task-inspector-summary-panel"/);
  assert.match(markup, /data-slot="task-inspector-overview"/);
  assert.match(markup, /data-slot="task-inspector-timeline"/);
  assert.match(markup, /data-slot="task-inspector-error"/);
  assert.match(markup, /data-slot="task-inspector-advanced"/);
  assert.match(markup, /Rate limit exceeded/);
  assert.match(markup, /Run ID/);
  assert.match(markup, /Flow ID/);
  assert.doesNotMatch(markup, /rounded-\[28px\]/);
});
