import assert from 'node:assert/strict';
import enApiLogs from './en/apiLogs.json' with { type: 'json' };
import zhApiLogs from './zh/apiLogs.json' with { type: 'json' };

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('api logs locale exposes prompt and completion labels in English and Chinese', () => {
  assert.equal(enApiLogs.logs.labels.input, 'Prompt');
  assert.equal(enApiLogs.logs.labels.output, 'Completion');
  assert.equal(zhApiLogs.logs.labels.input, '\u63d0\u793a');
  assert.equal(zhApiLogs.logs.labels.output, '\u8865\u5168');
});
