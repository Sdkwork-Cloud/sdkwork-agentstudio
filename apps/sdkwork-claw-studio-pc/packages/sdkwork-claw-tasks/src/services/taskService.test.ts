import assert from 'node:assert/strict';
import { taskService as coreTaskService } from '@sdkwork/claw-core';
import { taskService } from './taskService.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
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
  'taskService re-exports the core task service singleton from the tasks package',
  async () => {
    assert.equal(taskService, coreTaskService);
  },
);

await runTest(
  'taskService exposes the current task management surface expected by the tasks package',
  async () => {
    assert.equal(typeof taskService.getList, 'function');
    assert.equal(typeof taskService.getById, 'function');
    assert.equal(typeof taskService.create, 'function');
    assert.equal(typeof taskService.update, 'function');
    assert.equal(typeof taskService.delete, 'function');
    assert.equal(typeof taskService.getTasks, 'function');
    assert.equal(typeof taskService.createTask, 'function');
    assert.equal(typeof taskService.updateTask, 'function');
    assert.equal(typeof taskService.updateTaskStatus, 'function');
    assert.equal(typeof taskService.deleteTask, 'function');
    assert.equal(typeof taskService.cloneTask, 'function');
    assert.equal(typeof taskService.runTaskNow, 'function');
    assert.equal(typeof taskService.listTaskExecutions, 'function');
    assert.equal(typeof taskService.listDeliveryChannels, 'function');
  },
);
