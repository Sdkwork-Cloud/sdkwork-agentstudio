import assert from 'node:assert/strict';
import enProviderCenter from './en/providerCenter.json' with { type: 'json' };
import zhProviderCenter from './zh/providerCenter.json' with { type: 'json' };

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

await runTest('provider center zh locale contains complete proxy observability labels', () => {
  const en = enProviderCenter;
  const zh = zhProviderCenter;

  assert.equal(en.page.title, 'Provider Center');
  assert.equal(zh.table.endpoint, '\u4e0a\u6e38\u57fa\u7840\u5730\u5740');
  assert.equal(zh.table.health, '\u5065\u5eb7\u5ea6');
  assert.equal(zh.table.usage, '\u7528\u91cf');
  assert.equal(zh.table.avgLatency, '\u5e73\u5747\u5ef6\u8fdf');
  assert.equal(zh.table.lastTest, '\u6700\u8fd1\u6d4b\u8bd5');
  assert.equal(zh.table.apiKey, 'API \u5bc6\u94a5');
  assert.equal(zh.table.llmDefault, '\u9ed8\u8ba4\u6a21\u578b');
  assert.equal(zh.table.totalTokensShort, '\u603b');
  assert.equal(zh.table.inputTokensShort, '\u5165');
  assert.equal(zh.table.outputTokensShort, '\u51fa');
  assert.equal(zh.table.cacheTokensShort, '\u7f13\u5b58');
  assert.equal(zh.states.notTested, '\u672a\u6d4b\u8bd5');
  assert.equal(zh.states.noIncidents, '\u6682\u65e0\u5f02\u5e38');
  assert.equal(zh.actions.test, '\u6d4b\u8bd5');
  assert.equal(zh.actions.testing, '\u6d4b\u8bd5\u4e2d...');
  assert.equal(zh.dialogs.editor.knownProvider, '\u5df2\u77e5\u63d0\u4f9b\u65b9');
  assert.equal(
    zh.dialogs.editor.knownProviderPlaceholder,
    '\u9009\u62e9\u5df2\u77e5\u63d0\u4f9b\u65b9',
  );
  assert.equal(zh.dialogs.editor.customProvider, '\u81ea\u5b9a\u4e49\u63d0\u4f9b\u65b9 ID');
  assert.equal(zh.dialogs.editor.providerId, '\u63d0\u4f9b\u65b9 ID');
  assert.equal(zh.dialogs.editor.providerVendor, '\u670d\u52a1\u5546');
  assert.equal(zh.dialogs.editor.modelFamily, '\u6a21\u578b\u7cfb\u5217');
  assert.equal(zh.dialogs.editor.baseUrl, '\u57fa\u7840 URL');
  assert.equal(zh.dialogs.editor.apiKey, 'API \u5bc6\u94a5');
  assert.equal(zh.dialogs.editor.defaultModel, '\u9ed8\u8ba4\u6a21\u578b');
  assert.equal(zh.dialogs.editor.sidebarTitle, '\u63d0\u4f9b\u65b9\u76ee\u5f55');
  assert.equal(zh.dialogs.editor.selectedProvider, '\u5f53\u524d\u63d0\u4f9b\u65b9');
  assert.equal(
    zh.actionSupportReasons.runtimeUnavailable,
    '\u5f53\u524d\u5bbf\u4e3b\u4e0d\u63d0\u4f9b\u672c\u5730\u4ee3\u7406\u8fd0\u884c\u65f6\u3002',
  );
  assert.equal(
    zh.actionSupportReasons.runtimeStatusUnavailable,
    '\u672c\u5730\u4ee3\u7406\u8fd0\u884c\u65f6\u72b6\u6001\u6682\u65f6\u4e0d\u53ef\u7528\u3002',
  );
  assert.equal(
    zh.actionSupportReasons.quickApplyRequiresLoopback,
    '\u5feb\u901f\u5e94\u7528\u53ea\u80fd\u7528\u4e8e\u4ec5\u56de\u73af\u76d1\u542c\u7684\u672c\u5730\u4ee3\u7406\u8fd0\u884c\u65f6\u3002',
  );
  assert.equal(zh.health.healthy, '\u5065\u5eb7');
  assert.equal(zh.testStatus.passed, '\u901a\u8fc7');
  assert.equal(zh.toasts.testPassed, '\u8def\u7531\u6d4b\u8bd5\u901a\u8fc7\u3002');
});
