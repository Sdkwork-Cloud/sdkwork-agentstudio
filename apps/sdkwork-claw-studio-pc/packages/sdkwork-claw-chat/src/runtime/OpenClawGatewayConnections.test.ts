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

const source = readFileSync(
  new URL('./OpenClawGatewayConnections.tsx', import.meta.url),
  'utf8',
);

await runTest(
  'OpenClawGatewayConnections invalidates chat agent catalogs when gateway agent catalog changes arrive',
  () => {
    assert.match(source, /useQueryClient/);
    assert.match(source, /openClawGatewaySessions/);
    assert.match(source, /subscribeAgentCatalogChanged/);
    assert.match(
      source,
      /queryKey:\s*\['chat', 'kernel-agent-catalog', event\.instanceId\]/,
    );
    assert.match(
      source,
      /queryKey:\s*\['chat', 'owned-kernel-agent-library', event\.instanceId\]/,
    );
  },
);
