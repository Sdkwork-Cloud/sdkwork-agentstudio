import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'packages/sdkwork-claw-chat/src/pages/useChatAgentCatalogState.ts',
  'utf8',
);

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest(
  'useChatAgentCatalogState subscribes to gateway agent catalog events and invalidates the active catalog query',
  () => {
    assert.match(source, /import\s+\{\s*useEffect\s*\}\s+from\s+'react';/);
    assert.match(source, /useQueryClient/);
    assert.match(source, /openClawGatewaySessions/);
    assert.match(source, /subscribeAgentCatalogChanged/);
    assert.match(source, /event\.instanceId\s*!==\s*activeInstanceId/);
    assert.match(
      source,
      /queryKey:\s*\[\s*'chat',\s*'kernel-agent-catalog',\s*event\.instanceId\s*\]/,
    );
  },
);
