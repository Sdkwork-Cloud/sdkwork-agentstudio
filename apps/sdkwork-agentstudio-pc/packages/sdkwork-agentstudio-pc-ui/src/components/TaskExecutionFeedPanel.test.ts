import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskExecutionFeedPanel } from './TaskExecutionFeedPanel.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('TaskExecutionFeedPanel renders execution cards with run metadata and actions', () => {
  const markup = renderToStaticMarkup(
    createElement(TaskExecutionFeedPanel, {
      title: 'Execution History',
      description: 'Inspect recent executions across all tasks.',
      loadingText: 'Loading history...',
      emptyTitle: 'No history',
      emptyDescription: 'No task executions are available.',
      taskNameLabel: 'Task',
      scheduleLabel: 'Schedule',
      runIdLabel: 'Run ID',
      startedAtLabel: 'Started at',
      finishedAtLabel: 'Finished at',
      entries: [
        {
          id: 'exec-1',
          taskName: 'Morning Briefing',
          status: 'Success',
          trigger: 'Scheduled',
          taskStatus: 'Active',
          summary: 'Completed successfully.',
          details: 'Delivered a summary to ops.',
          schedule: '0 9 * * *',
          runId: 'run-1',
          startedAt: '2026-04-17T08:00:00.000Z',
          finishedAt: '2026-04-17T08:02:00.000Z',
          action: createElement('span', null, 'Open task history'),
        },
      ],
    }),
  );

  assert.match(markup, /Execution History/);
  assert.match(markup, /Morning Briefing/);
  assert.match(markup, /Run ID/);
  assert.match(markup, /run-1/);
  assert.match(markup, /Task/);
  assert.match(markup, /Open task history/);
  assert.match(markup, /data-slot="task-execution-feed-panel"/);
  assert.match(markup, /data-slot="task-execution-feed-run-id"/);
  assert.match(markup, /data-slot="task-execution-feed-task-name"/);
  assert.match(markup, /data-slot="task-execution-feed-meta-strip"/);
  assert.match(markup, /data-slot="task-execution-feed-meta-item"/);
  assert.doesNotMatch(markup, /max-w-\[1120px\]/);
  assert.doesNotMatch(markup, /rounded-\[32px\]/);
  assert.doesNotMatch(markup, /rounded-\[28px\]/);
  assert.doesNotMatch(markup, /rounded-\[26px\]/);
});
