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

const bannerPath = new URL('./BuiltInOpenClawStartupBanner.tsx', import.meta.url);

await runTest(
  'BuiltInOpenClawStartupBanner exposes bundled OpenClaw diagnostic log actions in the source',
  async () => {
    const source = await readFile(bannerPath, 'utf8');

    assert.match(source, /instances\.detail\.actions\.openGatewayLog/);
    assert.match(source, /instances\.detail\.actions\.revealDesktopMainLog/);
    assert.match(source, /onOpenDiagnosticPath/);
  },
);
