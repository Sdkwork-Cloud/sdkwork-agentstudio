import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

const headerPath = new URL('./InstanceDetailHeader.tsx', import.meta.url);
const openClawPagePath = new URL('../pages/OpenClawInstanceDetailPage.tsx', import.meta.url);
const hermesPagePath = new URL('../pages/HermesInstanceDetailPage.tsx', import.meta.url);
const zhInstancesLocalePath = new URL(
  '../../../sdkwork-claw-i18n/src/locales/zh/instances.json',
  import.meta.url,
);
const enInstancesLocalePath = new URL(
  '../../../sdkwork-claw-i18n/src/locales/en/instances.json',
  import.meta.url,
);

await runTest(
  'instance detail header keeps a single top-level status badge while preserving the shared control-page action',
  async () => {
    const headerSource = await readFile(headerPath, 'utf8');
    const openClawPageSource = await readFile(openClawPagePath, 'utf8');
    const hermesPageSource = await readFile(hermesPagePath, 'utf8');

    assert.match(headerSource, /getSharedStatusLabel/);
    assert.match(headerSource, /instances\.detail\.actions\.openControlPage/);
    assert.doesNotMatch(headerSource, /instances\.detail\.instanceWorkbench\.runtimeStates\.\$\{runtimeStatus\}/);
    assert.doesNotMatch(headerSource, /getRuntimeStatusTone/);
    assert.doesNotMatch(headerSource, /runtimeStatus:/);
    assert.match(openClawPageSource, /onOpenControlPage=\{consoleHandlers\.onOpenControlPage\}/);
    assert.match(hermesPageSource, /instances\.detail\.actions\.openControlPage/);
    assert.match(hermesPageSource, /consoleHandlers\.onOpenControlPage/);
  },
);

await runTest(
  'instances locale copy renames the shared control-page action to the console terminology',
  async () => {
    const zhLocale = JSON.parse(await readFile(zhInstancesLocalePath, 'utf8')) as {
      detail?: { actions?: { openControlPage?: string } };
    };
    const enLocale = JSON.parse(await readFile(enInstancesLocalePath, 'utf8')) as {
      detail?: { actions?: { openControlPage?: string } };
    };

    assert.equal(zhLocale.detail?.actions?.openControlPage, '前往控制台');
    assert.equal(enLocale.detail?.actions?.openControlPage, 'Open Console');
  },
);
