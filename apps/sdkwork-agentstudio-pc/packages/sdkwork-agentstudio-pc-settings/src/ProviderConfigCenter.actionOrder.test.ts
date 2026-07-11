import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

await runTest('provider config center renders the test action after higher-priority row actions', () => {
  const source = readFileSync(new URL('./ProviderConfigCenter.tsx', import.meta.url), 'utf8');
  const quickApplyIndex = source.indexOf("setApplyTarget(record)");
  const editIndex = source.indexOf('openEditDialog(record)');
  const deleteIndex = source.indexOf('setDeleteTarget(record)');
  const testIndex = source.indexOf('handleTestRoute(record.id)');

  assert.notEqual(quickApplyIndex, -1);
  assert.notEqual(editIndex, -1);
  assert.notEqual(deleteIndex, -1);
  assert.notEqual(testIndex, -1);

  assert.equal(quickApplyIndex < testIndex, true);
  assert.equal(editIndex < testIndex, true);
  assert.equal(deleteIndex < testIndex, true);
});

await runTest('provider config center lets users open route details from the row without displacing action priority', () => {
  const source = readFileSync(new URL('./ProviderConfigCenter.tsx', import.meta.url), 'utf8');
  const doubleClickIndex = source.indexOf('onDoubleClick={() => openViewDialog(record)}');
  const editIndex = source.indexOf('openEditDialog(record)');
  const testIndex = source.indexOf('handleTestRoute(record.id)');

  assert.notEqual(doubleClickIndex, -1);
  assert.notEqual(editIndex, -1);
  assert.notEqual(testIndex, -1);

  assert.equal(doubleClickIndex < editIndex, true);
  assert.equal(doubleClickIndex < testIndex, true);
});

await runTest(
  'provider config center disables unsupported quick-apply and test actions instead of exposing false affordances',
  () => {
    const source = readFileSync(new URL('./ProviderConfigCenter.tsx', import.meta.url), 'utf8');

    assert.match(source, /providerConfigCenterWorkspaceService\.loadOverview\(/);
    assert.match(source, /resolveActionSupportReasonLabel\(/);
    assert.match(source, /case 'quickApplyRequiresLoopback':/);
    assert.match(source, /disabled=\{!actionSupport\.quickApply\.available\}/);
    assert.match(source, /title=\{resolveActionSupportReasonLabel\(t, actionSupport\.quickApply\) \|\| undefined\}/);
    assert.match(source, /disabled=\{!actionSupport\.test\.available \|\| Boolean\(testingRouteId\)\}/);
    assert.match(
      source,
      /title=\{actionSupport\.test\.available \? undefined : resolveActionSupportReasonLabel\(t, actionSupport\.test\) \|\| undefined\}/,
    );
  },
);
