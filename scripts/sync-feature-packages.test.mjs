import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function runTest(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

runTest(
  'sync-feature-packages tolerates feature packages that do not own a components directory',
  async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'sync-feature-packages-test-'));
    try {
      const tempPackagesDir = path.join(tempRoot, 'packages', 'sdkwork-agentstudio-pc-agent');
      const tempSrcDir = path.join(tempPackagesDir, 'src');
      const tempPagesDir = path.join(tempSrcDir, 'pages');
      const tempServicesDir = path.join(tempSrcDir, 'services');
      const tempScriptDir = path.join(tempRoot, 'scripts');
      const tempScriptPath = path.join(tempScriptDir, 'sync-feature-packages.mjs');

      await mkdir(tempPagesDir, { recursive: true });
      await mkdir(tempServicesDir, { recursive: true });
      await mkdir(tempScriptDir, { recursive: true });

      await writeFile(
        path.join(tempPackagesDir, 'package.json'),
        `${JSON.stringify(
          {
            name: '@sdkwork/agentstudio-pc-agent',
            private: true,
            version: '0.1.0',
            type: 'module',
            dependencies: {},
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(
        path.join(tempPagesDir, 'AgentMarket.tsx'),
        'export function AgentMarket() { return null; }\n',
      );
      await writeFile(
        path.join(tempServicesDir, 'agentInstallService.ts'),
        'export function installAgent() { return true; }\n',
      );
      await writeFile(path.join(tempSrcDir, 'index.ts'), 'export {};\n');
      await writeFile(
        tempScriptPath,
        await readFile(path.join(root, 'scripts', 'sync-feature-packages.mjs'), 'utf8'),
      );

      const previousCwd = process.cwd();
      try {
        process.chdir(tempRoot);
        await import(`${pathToFileURL(tempScriptPath).href}?t=${Date.now()}`);
      } finally {
        process.chdir(previousCwd);
      }

      assert.equal(
        fs.existsSync(path.join(tempSrcDir, 'components')),
        false,
        'sync-feature-packages should not create an empty components directory for packages that do not own one',
      );

      const servicesIndexSource = await readFile(path.join(tempServicesDir, 'index.ts'), 'utf8');
      assert.match(servicesIndexSource, /agentInstallService/);

      const rootIndexSource = await readFile(path.join(tempSrcDir, 'index.ts'), 'utf8');
      assert.match(rootIndexSource, /\.\/services/);
      assert.doesNotMatch(rootIndexSource, /pages\/AgentMarket/);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  },
);

runTest(
  'sync-feature-packages ignores host packages that are outside the feature sync surface',
  async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'sync-feature-packages-host-test-'));
    try {
      const tempAgentDir = path.join(tempRoot, 'packages', 'sdkwork-agentstudio-pc-agent');
      const tempAgentSrcDir = path.join(tempAgentDir, 'src');
      const tempAgentPagesDir = path.join(tempAgentSrcDir, 'pages');
      const tempAgentServicesDir = path.join(tempAgentSrcDir, 'services');
      const tempHostStudioDir = path.join(tempRoot, 'packages', 'sdkwork-agentstudio-pc-host-studio');
      const tempHostStudioSrcHostDir = path.join(tempHostStudioDir, 'src-host');
      const tempScriptDir = path.join(tempRoot, 'scripts');
      const tempScriptPath = path.join(tempScriptDir, 'sync-feature-packages.mjs');

      await mkdir(tempAgentPagesDir, { recursive: true });
      await mkdir(tempAgentServicesDir, { recursive: true });
      await mkdir(tempHostStudioSrcHostDir, { recursive: true });
      await mkdir(tempScriptDir, { recursive: true });

      await writeFile(
        path.join(tempAgentDir, 'package.json'),
        `${JSON.stringify(
          {
            name: '@sdkwork/agentstudio-pc-agent',
            private: true,
            version: '0.1.0',
            type: 'module',
            dependencies: {},
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(
        path.join(tempAgentPagesDir, 'AgentMarket.tsx'),
        'export function AgentMarket() { return null; }\n',
      );
      await writeFile(
        path.join(tempAgentServicesDir, 'agentInstallService.ts'),
        'export function installAgent() { return true; }\n',
      );
      await writeFile(path.join(tempAgentSrcDir, 'index.ts'), 'export {};\n');

      await writeFile(
        path.join(tempHostStudioDir, 'package.json'),
        `${JSON.stringify(
          {
            name: '@sdkwork/agentstudio-pc-host-studio',
            private: true,
            version: '0.1.0',
            type: 'module',
            dependencies: {},
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(path.join(tempHostStudioSrcHostDir, 'Cargo.toml'), '[package]\nname = "host-studio"\n');

      await writeFile(
        tempScriptPath,
        await readFile(path.join(root, 'scripts', 'sync-feature-packages.mjs'), 'utf8'),
      );

      const previousCwd = process.cwd();
      try {
        process.chdir(tempRoot);
        await import(`${pathToFileURL(tempScriptPath).href}?t=${Date.now()}-host`);
      } finally {
        process.chdir(previousCwd);
      }

      assert.equal(
        fs.existsSync(path.join(tempHostStudioDir, 'src')),
        false,
        'sync-feature-packages should not create a synthetic src tree for host-only packages',
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  },
);

runTest(
  'sync-feature-packages publishes top-level wrapper modules instead of deep pages paths at the package root',
  async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'sync-feature-packages-root-export-test-'));
    try {
      const tempAppsDir = path.join(tempRoot, 'packages', 'sdkwork-agentstudio-pc-apps');
      const tempAppsSrcDir = path.join(tempAppsDir, 'src');
      const tempPagesDir = path.join(tempAppsSrcDir, 'pages', 'apps');
      const tempServicesDir = path.join(tempAppsSrcDir, 'services');
      const tempScriptDir = path.join(tempRoot, 'scripts');
      const tempScriptPath = path.join(tempScriptDir, 'sync-feature-packages.mjs');

      await mkdir(tempPagesDir, { recursive: true });
      await mkdir(tempServicesDir, { recursive: true });
      await mkdir(tempScriptDir, { recursive: true });

      await writeFile(
        path.join(tempAppsDir, 'package.json'),
        `${JSON.stringify(
          {
            name: '@sdkwork/agentstudio-pc-apps',
            private: true,
            version: '0.1.0',
            type: 'module',
            dependencies: {},
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(path.join(tempAppsSrcDir, 'AppStore.tsx'), "export * from './pages/apps/AppStore';\n");
      await writeFile(path.join(tempAppsSrcDir, 'AppDetail.tsx'), "export * from './pages/apps/AppDetail';\n");
      await writeFile(
        path.join(tempPagesDir, 'AppStore.tsx'),
        'export function AppStorePage() { return null; }\n',
      );
      await writeFile(
        path.join(tempPagesDir, 'AppDetail.tsx'),
        'export function AppDetailPage() { return null; }\n',
      );
      await writeFile(
        path.join(tempServicesDir, 'appStoreService.ts'),
        'export function listApps() { return []; }\n',
      );
      await writeFile(path.join(tempAppsSrcDir, 'index.ts'), 'export {};\n');

      await writeFile(
        tempScriptPath,
        await readFile(path.join(root, 'scripts', 'sync-feature-packages.mjs'), 'utf8'),
      );

      const previousCwd = process.cwd();
      try {
        process.chdir(tempRoot);
        await import(`${pathToFileURL(tempScriptPath).href}?t=${Date.now()}-root`);
      } finally {
        process.chdir(previousCwd);
      }

      const rootIndexSource = await readFile(path.join(tempAppsSrcDir, 'index.ts'), 'utf8');
      assert.match(rootIndexSource, /export \* from '\.\/AppDetail';/);
      assert.match(rootIndexSource, /export \* from '\.\/AppStore';/);
      assert.doesNotMatch(rootIndexSource, /pages\/apps/);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  },
);
