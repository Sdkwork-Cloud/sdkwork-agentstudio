import assert from 'node:assert/strict';
import enAggregate from './en.json' with { type: 'json' };
import en from './en/instances.json' with { type: 'json' };
import zhAggregate from './zh.json' with { type: 'json' };
import zh from './zh/instances.json' with { type: 'json' };

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

await runTest('instances en locale exposes configFile labels for OpenClaw management surfaces', () => {
  assert.equal(en.list.associateDialog.labels.configFile, 'OpenClaw config file');
  assert.equal('configPath' in en.list.associateDialog.labels, false);
  assert.equal(
    en.detail.instanceWorkbench.overview.management.labels.kernelConfig,
    'OpenClaw config file',
  );
  assert.equal(
    en.detail.instanceWorkbench.overview.management.details.configUnavailable,
    'No authoritative OpenClaw config file is currently attached to this instance.',
  );
  assert.equal(en.detail.instanceWorkbench.config.overview.managedFile, 'OpenClaw config file');
  assert.equal(en.detail.instanceWorkbench.llmProviders.panel.configFile, 'OpenClaw config file');
  assert.equal(en.detail.instanceWorkbench.agents.panel.configFile, 'OpenClaw config file');
});

await runTest('instances zh locale exposes configFile labels for OpenClaw management surfaces', () => {
  assert.equal(typeof zh.list.associateDialog.labels.configFile, 'string');
  assert.equal(zh.list.associateDialog.labels.configFile.length > 0, true);
  assert.equal('configPath' in zh.list.associateDialog.labels, false);
  assert.equal(typeof zh.detail.instanceWorkbench.overview.management.labels.kernelConfig, 'string');
  assert.equal(
    typeof zh.detail.instanceWorkbench.overview.management.details.configUnavailable,
    'string',
  );
  assert.equal(typeof zh.detail.instanceWorkbench.config.overview.managedFile, 'string');
  assert.equal(typeof zh.detail.instanceWorkbench.llmProviders.panel.configFile, 'string');
  assert.equal(typeof zh.detail.instanceWorkbench.agents.panel.configFile, 'string');
});

await runTest('aggregate locale bundles keep configFile naming for OpenClaw and provider center surfaces', () => {
  assert.equal(enAggregate.instances.list.associateDialog.labels.configFile, 'OpenClaw config file');
  assert.equal('configPath' in enAggregate.instances.list.associateDialog.labels, false);
  assert.equal(enAggregate.install.page.guided.config.configFile, 'Config file');
  assert.equal('configPath' in enAggregate.install.page.guided.config, false);
  assert.equal(enAggregate.providerCenter.dialogs.apply.configFile, 'OpenClaw config file');
  assert.equal('configPath' in enAggregate.providerCenter.dialogs.apply, false);
  assert.equal(enAggregate.settings.kernelCenter.fields.configFile, 'Config file');
  assert.equal('configPath' in enAggregate.settings.kernelCenter.fields, false);

  assert.equal(typeof zhAggregate.instances.list.associateDialog.labels.configFile, 'string');
  assert.equal(zhAggregate.instances.list.associateDialog.labels.configFile.length > 0, true);
  assert.equal('configPath' in zhAggregate.instances.list.associateDialog.labels, false);
  assert.equal(typeof zhAggregate.install.page.guided.config.configFile, 'string');
  assert.equal(zhAggregate.install.page.guided.config.configFile.length > 0, true);
  assert.equal('configPath' in zhAggregate.install.page.guided.config, false);
  assert.equal(typeof zhAggregate.providerCenter.dialogs.apply.configFile, 'string');
  assert.equal(zhAggregate.providerCenter.dialogs.apply.configFile.length > 0, true);
  assert.equal('configPath' in zhAggregate.providerCenter.dialogs.apply, false);
  assert.equal(typeof zhAggregate.settings.kernelCenter.fields.configFile, 'string');
  assert.equal(zhAggregate.settings.kernelCenter.fields.configFile.length > 0, true);
  assert.equal('configPath' in zhAggregate.settings.kernelCenter.fields, false);
});
