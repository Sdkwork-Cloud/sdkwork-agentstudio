import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const packageContracts = [
  {
    pkg: 'channels',
    files: [
      'packages/sdkwork-agentstudio-pc-channels/src/Channels.tsx',
      'packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts',
    ],
    requiredExports: ["export * from './Channels';"],
  },
  {
    pkg: 'community',
    files: [
      'packages/sdkwork-agentstudio-pc-community/src/Community.tsx',
      'packages/sdkwork-agentstudio-pc-community/src/CommunityPostDetail.tsx',
      'packages/sdkwork-agentstudio-pc-community/src/NewPost.tsx',
      'packages/sdkwork-agentstudio-pc-community/src/services/communityService.ts',
    ],
    requiredExports: [
      "export * from './Community';",
      "export * from './CommunityPostDetail';",
      "export * from './NewPost';",
    ],
  },
  {
    pkg: 'devices',
    files: [
      'packages/sdkwork-agentstudio-pc-devices/src/Devices.tsx',
      'packages/sdkwork-agentstudio-pc-devices/src/services/deviceService.ts',
    ],
    requiredExports: ["export * from './Devices';"],
  },
  {
    pkg: 'docs',
    files: [
      'packages/sdkwork-agentstudio-pc-docs/src/Docs.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/index.ts',
      'packages/sdkwork-agentstudio-pc-docs/src/content/ArchitectureDoc.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/CliDoc.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/InstallDoc.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/IntroDoc.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/QuickstartDoc.tsx',
      'packages/sdkwork-agentstudio-pc-docs/src/content/SkillsDoc.tsx',
    ],
    requiredExports: ["export * from './Docs';", "export * from './content';"],
  },
  {
    pkg: 'extensions',
    files: [
      'packages/sdkwork-agentstudio-pc-extensions/src/Extensions.tsx',
      'packages/sdkwork-agentstudio-pc-extensions/src/services/extensionService.ts',
    ],
    requiredExports: ["export * from './Extensions';"],
  },
] as const;

runTest('remaining sdkwork feature packages are implemented locally instead of bridge re-exports', () => {
  for (const contract of packageContracts) {
    const packagePath = `packages/sdkwork-agentstudio-pc-${contract.pkg}/package.json`;
    const indexPath = `packages/sdkwork-agentstudio-pc-${contract.pkg}/src/index.ts`;
    const pkg = readJson<{ dependencies?: Record<string, string> }>(packagePath);
    const indexSource = read(indexPath);

    assert.ok(!pkg.dependencies?.[`@sdkwork/agentstudio-pc-studio-${contract.pkg}`], contract.pkg);
    assert.doesNotMatch(indexSource, /@sdkwork\/agent-studio-/);

    for (const file of contract.files) {
      assert.ok(exists(file), file);
    }

    for (const exportLine of contract.requiredExports) {
      assert.match(indexSource, new RegExp(exportLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});
