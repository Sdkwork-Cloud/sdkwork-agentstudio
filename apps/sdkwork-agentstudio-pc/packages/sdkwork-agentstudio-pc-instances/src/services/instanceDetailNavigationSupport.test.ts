import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

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

async function loadInstanceDetailNavigationSupportModule() {
  const moduleUrl = new URL('./instanceDetailNavigationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailNavigationSupport.ts to exist',
  );

  return import('./instanceDetailNavigationSupport.ts');
}

await runTest(
  'createSharedStatusLabelGetter maps instance shared status keys through the injected translator',
  async () => {
    const { createSharedStatusLabelGetter } = await loadInstanceDetailNavigationSupportModule();

    const getSharedStatusLabel = createSharedStatusLabelGetter(
      (key: string) => `translated:${key}`,
    );

    assert.equal(
      getSharedStatusLabel('online'),
      'translated:instances.shared.status.online',
    );
    assert.equal(
      getSharedStatusLabel('offline'),
      'translated:instances.shared.status.offline',
    );
  },
);

await runTest(
  'buildInstanceDetailNavigationHandlers routes back, provider-center, agent-market, and set-active actions through injected page-owned callbacks',
  async () => {
    const { buildInstanceDetailNavigationHandlers } =
      await loadInstanceDetailNavigationSupportModule();
    const callLog: string[] = [];

    const handlers = buildInstanceDetailNavigationHandlers({
      instance: { id: 'instance-01' },
      navigate: (href) => {
        callLog.push(`navigate:${href}`);
      },
      openAgentMarketModal: () => {
        callLog.push('modal:agent-market');
      },
      setActiveInstanceId: (instanceId) => {
        callLog.push(`active:${instanceId}`);
      },
    });

    handlers.onBackToInstances();
    handlers.onOpenProviderCenter();
    handlers.onOpenAgentMarket();
    handlers.onSetActive();

    assert.deepEqual(callLog, [
      'navigate:/instances',
      'navigate:/settings?tab=api',
      'modal:agent-market',
      'active:instance-01',
    ]);
  },
);

await runTest(
  'buildInstanceDetailNavigationHandlers keeps agent-market access modal-only and never emits a route fallback',
  async () => {
    const source = (await loadInstanceDetailNavigationSupportModule()).buildInstanceDetailNavigationHandlers
      .toString();

    assert.doesNotMatch(source, /navigate\(`\/agents\$\{search\}`\)/);
    assert.doesNotMatch(source, /encodeURIComponent\(args\.instanceId\)/);
    assert.match(source, /args\.openAgentMarketModal\(\);/);
  },
);
