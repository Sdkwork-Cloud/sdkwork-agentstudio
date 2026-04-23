import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskStudioTabs } from './TaskStudioTabs.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('TaskStudioTabs renders compact top tabs with counts and active emphasis', () => {
  const markup = renderToStaticMarkup(
    createElement(TaskStudioTabs, {
      activeTab: 'tasks',
      tabs: [
        { id: 'tasks', label: 'Task List', count: 12 },
        { id: 'history', label: 'Execution History', count: 5 },
      ],
      onChange: () => undefined,
    }),
  );

  assert.match(markup, /Task List/);
  assert.match(markup, /Execution History/);
  assert.match(markup, /data-slot="task-studio-tabs"/);
  assert.match(markup, /inline-flex w-fit max-w-full/);
  assert.match(markup, /gap-1/);
  assert.match(markup, /rounded-\[0\.875rem\]/);
  assert.match(markup, /p-1/);
  assert.match(markup, /h-9 min-w-\[9rem\]/);
  assert.match(markup, /rounded-\[0\.75rem\] px-3 text-left text-\[13px\]/);
  assert.match(markup, /rounded-full px-1\.5 py-0\.5 text-\[11px\]/);
  assert.doesNotMatch(markup, /rounded-\[1rem\]/);
  assert.match(markup, /bg-zinc-950 text-white/);
  assert.doesNotMatch(markup, /inline-flex w-full/);
  assert.doesNotMatch(markup, /flex-1 items-center/);
  assert.match(markup, />12</);
  assert.match(markup, />5</);
});
