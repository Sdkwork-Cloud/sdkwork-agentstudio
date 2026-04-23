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

const instanceDetailPath = new URL('./InstanceDetail.tsx', import.meta.url);
const openClawInstanceDetailPagePath = new URL('./OpenClawInstanceDetailPage.tsx', import.meta.url);
const hermesInstanceDetailPagePath = new URL('./HermesInstanceDetailPage.tsx', import.meta.url);
const unsupportedInstanceDetailPagePath = new URL('./UnsupportedInstanceDetailPage.tsx', import.meta.url);

await runTest(
  'InstanceDetail keeps shared routing separate from kernel detail implementations and passes a structured detail source',
  async () => {
    const routeSource = await readFile(instanceDetailPath, 'utf8');
    const openClawDetailSource = await readFile(openClawInstanceDetailPagePath, 'utf8');
    const hermesDetailSource = await readFile(hermesInstanceDetailPagePath, 'utf8');
    const unsupportedDetailSource = await readFile(unsupportedInstanceDetailPagePath, 'utf8');

    assert.match(routeSource, /useMemo/);
    assert.match(routeSource, /resolveSupportedInstanceDetailModule\(/);
    assert.match(routeSource, /createInstanceDetailSource\(/);
    assert.match(routeSource, /detailModule\.DetailPage/);
    assert.match(
      routeSource,
      /<DetailPage[\s\S]*source=\{detailSource\}[\s\S]*onOpenAgentMarketModal=\{onOpenAgentMarketModal\}[\s\S]*\/>/,
    );
    assert.match(routeSource, /loadBaseDetail:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.match(routeSource, /loadModulePayload:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.match(routeSource, /const detailSource = useMemo\(/);
    assert.match(routeSource, /const kernelId = instance \? resolveRegistryKernelId\(instance\) : 'custom';/);
    assert.match(routeSource, /resolveSupportedInstanceDetailModule\(kernelId\)/);
    assert.match(routeSource, /kernelId=\{kernelId\}/);
    assert.match(routeSource, /kernelId,\s*$/m);
    assert.doesNotMatch(routeSource, /detailModule === 'hermes'/);
    assert.doesNotMatch(routeSource, /detailModule !== 'openclaw'/);
    assert.doesNotMatch(routeSource, /function OpenClawInstanceDetailPage\(/);
    assert.doesNotMatch(routeSource, /buildOpenClawAgentDialogStateHandlers/);
    assert.doesNotMatch(routeSource, /resolveRegistryRuntimeKind\(instance\)/);

    const detailSourceIndex = routeSource.indexOf('const detailSource = useMemo(');
    const loadingGuardIndex = routeSource.indexOf('if (isLoading) {');
    const notFoundGuardIndex = routeSource.indexOf('if (!id || !instance) {');
    assert.ok(detailSourceIndex >= 0, 'Expected a memoized detail source definition');
    assert.ok(loadingGuardIndex >= 0, 'Expected an isLoading guard');
    assert.ok(notFoundGuardIndex >= 0, 'Expected a not-found guard');
    assert.ok(
      detailSourceIndex < loadingGuardIndex,
      'Expected detail-source hooks to execute before the loading early return',
    );
    assert.ok(
      detailSourceIndex < notFoundGuardIndex,
      'Expected detail-source hooks to execute before the not-found early return',
    );

    assert.match(openClawDetailSource, /function OpenClawInstanceDetailPage\(/);
    assert.match(openClawDetailSource, /type InstanceDetailPageProps,/);
    assert.match(openClawDetailSource, /\}: InstanceDetailPageProps\)/);
    assert.match(openClawDetailSource, /buildOpenClawAgentDialogStateHandlers/);
    assert.match(openClawDetailSource, /buildInstanceConsoleHandlers/);
    assert.match(openClawDetailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.match(openClawDetailSource, /getOpenClawWorkbenchFromModulePayload/);
    assert.match(openClawDetailSource, /instanceWorkbenchService\.getInstanceWorkbench\(instanceId\)/);
    const openClawDerivedStateIndex = openClawDetailSource.indexOf('const instanceDetailDerivedState = useMemo(');
    const openClawAgentWorkbenchEffectIndex = openClawDetailSource.indexOf(
      'return startLoadInstanceDetailAgentWorkbench({',
    );
    assert.ok(
      openClawDerivedStateIndex >= 0,
      'Expected OpenClaw detail page to declare derived workbench state',
    );
    assert.ok(
      openClawAgentWorkbenchEffectIndex >= 0,
      'Expected OpenClaw detail page to load agent workbench from an effect',
    );
    assert.ok(
      openClawDerivedStateIndex < openClawAgentWorkbenchEffectIndex,
      'Expected derived workbench state to be declared before the agent workbench effect uses it',
    );
    assert.doesNotMatch(openClawDetailSource, /getOpenClawInstanceDetailSourceExtension/);

    assert.match(hermesDetailSource, /function HermesInstanceDetailPage\(/);
    assert.match(hermesDetailSource, /type InstanceDetailPageProps,/);
    assert.match(hermesDetailSource, /\}: InstanceDetailPageProps\)/);
    assert.match(hermesDetailSource, /buildInstanceConsoleHandlers/);
    assert.match(hermesDetailSource, /source\s*\.\s*loadBaseDetail\(\)/);
    assert.match(hermesDetailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.match(hermesDetailSource, /management\.consoleAvailability/);
    assert.match(hermesDetailSource, /instances\.detail\.actions\.openControlPage/);
    assert.match(hermesDetailSource, /instances\.detail\.modules\.hermes\.readiness\.title/);
    assert.match(hermesDetailSource, /sections\.readinessChecks/);
    assert.doesNotMatch(hermesDetailSource, /\}, \[source\]\);/);
    assert.doesNotMatch(hermesDetailSource, /instanceWorkbenchService\.getInstanceWorkbench\(instanceId\)/);
    assert.doesNotMatch(hermesDetailSource, /source\.loadWorkbench\(\)/);
    assert.doesNotMatch(hermesDetailSource, /buildHermesRuntimePolicies\(/);

    assert.match(unsupportedDetailSource, /interface UnsupportedInstanceDetailPageProps \{/);
    assert.match(unsupportedDetailSource, /kernelId:\s*string;/);
    assert.match(unsupportedDetailSource, /kernel:\s*formatWorkbenchLabel\(kernelId\)/);
    assert.doesNotMatch(unsupportedDetailSource, /runtimeKind:\s*string;/);
    assert.doesNotMatch(unsupportedDetailSource, /formatWorkbenchLabel\(runtimeKind\)/);
  },
);
