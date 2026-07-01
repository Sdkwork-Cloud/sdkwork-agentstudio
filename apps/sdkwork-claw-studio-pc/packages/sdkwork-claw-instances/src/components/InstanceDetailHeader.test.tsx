import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/claw-types';
import { InstanceDetailHeader } from './InstanceDetailHeader.tsx';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

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

await runTest(
  'InstanceDetailHeader keeps a single top-level status badge while preserving instance-level actions',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailHeader
        activeInstanceId="instance-1"
        instance={{
          id: 'instance-1',
          name: 'OpenClaw Desktop',
          status: 'online',
          ip: '127.0.0.1',
          uptime: '2h',
          type: 'builtin',
          version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
        } as any}
        canSetActive
        canOpenControlPage
        canControlLifecycle
        canRestartLifecycle
        canStopLifecycle
        canStartLifecycle={false}
        canDelete
        t={(key, options) => (options ? `${key}:${JSON.stringify(options)}` : key)}
        getSharedStatusLabel={(status) => `status:${status}`}
        getStatusBadge={(status) => `status-badge:${status}`}
        onSetActive={() => undefined}
        onOpenControlPage={() => undefined}
        onRestart={() => undefined}
        onStop={() => undefined}
        onStart={() => undefined}
        onDelete={() => undefined}
      />,
    );

    assert.match(markup, /OpenClaw Desktop/);
    assert.match(markup, /instances\.detail\.activeBadge/);
    assert.match(markup, /status:online/);
    assert.doesNotMatch(markup, /instances\.detail\.instanceWorkbench\.runtimeStates\.healthy/);
    assert.match(markup, /instances\.detail\.uptime:\{&quot;value&quot;:&quot;2h&quot;\}/);
    assert.match(markup, /instances\.detail\.actions\.openControlPage/);
    assert.match(markup, /instances\.detail\.actions\.restart/);
    assert.match(markup, /instances\.detail\.actions\.stop/);
    assert.match(markup, /instances\.detail\.actions\.uninstallInstance/);
    assert.doesNotMatch(markup, /instances\.detail\.actions\.setAsActive/);
  },
);

await runTest(
  'InstanceDetailHeader keeps the console action visible for built-in instances while suppressing uninstall',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailHeader
        activeInstanceId={null}
        instance={{
          id: BUILT_IN_INSTANCE_ID,
          name: 'Built-In OpenClaw',
          status: 'online',
          ip: '127.0.0.1',
          uptime: '9m',
          type: 'builtin',
          version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
        } as any}
        canSetActive={false}
        canOpenControlPage
        canControlLifecycle
        canRestartLifecycle
        canStopLifecycle
        canStartLifecycle={false}
        canDelete={false}
        t={(key) =>
          key === 'instances.detail.actions.openControlPage'
            ? '前往控制台'
            : key === 'instances.detail.actions.uninstallInstance'
              ? '卸载实例'
              : key
        }
        getSharedStatusLabel={(status) => `status:${status}`}
        getStatusBadge={(status) => `status-badge:${status}`}
        onSetActive={() => undefined}
        onOpenControlPage={() => undefined}
        onRestart={() => undefined}
        onStop={() => undefined}
        onStart={() => undefined}
        onDelete={() => undefined}
      />,
    );

    assert.match(markup, /前往控制台/);
    assert.doesNotMatch(markup, /卸载实例/);
  },
);
