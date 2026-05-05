import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();

async function main() {
  const modulePath = path.join(root, 'scripts/run-vitepress.mjs');
  const moduleUrl = new URL(`file://${modulePath}`);
  const {
    ensureVitepressPackageLink,
    maybeCleanVitepressDist,
    parseSimpleYaml,
    resolveVitepressCli,
    runStaticDocsBuild,
    verifyStaticDocsLinks,
  } = await import(moduleUrl.href);
  const vitepressCli = resolveVitepressCli(root);
  const vitepressPackageLink = ensureVitepressPackageLink(root);

  assert.ok(vitepressCli, 'expected to resolve a VitePress CLI path');
  assert.ok(fs.existsSync(vitepressCli), `expected CLI to exist: ${vitepressCli}`);
  assert.ok(vitepressPackageLink, 'expected to ensure a VitePress package link');
  assert.ok(
    fs.existsSync(path.join(vitepressPackageLink, 'package.json')),
    `expected package link to expose package.json: ${vitepressPackageLink}`,
  );
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(
    source,
    /child\.on\('error', \(error\) => \{\s*console\.error\(`\[run-vitepress\] \$\{error\.message\}`\);\s*process\.exit\(1\);\s*\}\);/s,
    'expected run-vitepress to handle child process startup failures explicitly',
  );
  assert.match(
    source,
    /if \(entryUrl === import\.meta\.url\) \{\s*main\(\)\.catch\(\(error\) => \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\);\s*\}/s,
    'expected run-vitepress to wrap the CLI entrypoint with a top-level error handler',
  );
  assert.match(
    source,
    /repairPnpmFallbackLinks/,
    'expected run-vitepress to repair pnpm fallback links before invoking the VitePress CLI',
  );
  assert.match(
    source,
    /runStaticDocsBuild/,
    'expected run-vitepress to provide a static docs build path that avoids VitePress production esbuild startup',
  );
  assert.match(
    source,
    /loadNativeDocsUserConfig/,
    'expected run-vitepress to load the docs config through native ESM import before static build',
  );
  assert.match(
    source,
    /verifyStaticDocsLinks/,
    'expected run-vitepress to verify generated static docs internal links before reporting a successful build',
  );
  assert.doesNotMatch(
    source,
    /await import\('vitepress'\)[\s\S]*build\(/,
    'docs production build must not invoke VitePress build because Vite/esbuild child processes are not release-portable',
  );

  const autoDiscoveredConfigPath = path.join(root, 'docs', '.vitepress', 'config.ts');
  const nativeConfigPath = path.join(root, 'docs', '.vitepress', 'siteConfig.mjs');
  assert.equal(
    fs.existsSync(autoDiscoveredConfigPath),
    false,
    'expected docs config to avoid VitePress auto-discovered TypeScript config loading',
  );
  assert.equal(
    fs.existsSync(nativeConfigPath),
    true,
    'expected docs config to exist as a native ESM module loaded by run-vitepress',
  );
  assert.equal(
    fs.existsSync(path.join(root, 'docs', '.vitepress', 'theme', 'index.ts')),
    false,
    'expected docs theme entry to avoid TypeScript transforms during VitePress builds',
  );
  assert.equal(
    fs.existsSync(path.join(root, 'docs', '.vitepress', 'theme', 'index.js')),
    true,
    'expected docs theme entry to be buildable as native JavaScript',
  );
  const nativeConfig = await import(new URL(`file://${nativeConfigPath}`).href);
  assert.equal(nativeConfig.default?.title, 'Claw Studio');
  assert.equal(
    nativeConfig.default?.lastUpdated,
    false,
    'expected native docs build to avoid Git child-process timestamp lookup in restricted build environments',
  );
  assert.deepEqual(nativeConfig.default?.srcExclude, [
    'community/**',
    'prompts/**',
    'release/**',
    'reports/**',
    'review/**',
    'step/**',
    'plans/**',
    'superpowers/**',
    'zh-CN/community/**',
    'zh-CN/prompts/**',
    'zh-CN/release/**',
    'zh-CN/reports/**',
    'zh-CN/review/**',
    'zh-CN/step/**',
    'zh-CN/plans/**',
    'zh-CN/superpowers/**',
    `${String.fromCodePoint(0x67b6, 0x6784)}/**`,
  ]);
  assert.deepEqual(
    parseSimpleYaml(
      [
        'first:',
        '  items:',
        '    label: object item',
        'second:',
        '  items:',
        '    - array item',
      ].join('\n'),
    ),
    {
      first: {
        items: {
          label: 'object item',
        },
      },
      second: {
        items: ['array item'],
      },
    },
    'expected duplicate frontmatter keys in different parents to inspect their own following line',
  );

  const staticTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-static-docs-'));
  const staticDocsRoot = path.join(staticTempRoot, 'docs');
  fs.mkdirSync(path.join(staticDocsRoot, '.vitepress'), { recursive: true });
  fs.writeFileSync(
    path.join(staticDocsRoot, '.vitepress', 'siteConfig.mjs'),
    [
      'export default {',
      "  title: 'Static Docs Fixture',",
      "  description: 'Fixture docs build.',",
      '  cleanUrls: true,',
      '  lastUpdated: false,',
      "  srcExclude: ['internal/**'],",
      '  themeConfig: {',
      '    logo: "/logo.svg",',
      '    nav: [{ text: "Start", link: "/guide/start" }],',
      '    sidebar: {',
      '      "/guide/": [{ text: "Guide", items: [{ text: "Start", link: "/guide/start" }] }],',
      '      "/nested/": [{ text: "Nested", items: [{ text: "Nested Home", link: "/nested/" }] }],',
      '    },',
      '  },',
      '  locales: { root: { label: "English", lang: "en-US", themeConfig: { nav: [{ text: "Start", link: "/guide/start" }] } } },',
      '};',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(staticDocsRoot, 'index.md'),
    '# Fixture Home\n\nWelcome [Start](/guide/start). Jump [setup](/guide/start.md#setup). Visit [Nested](/nested/).',
  );
  fs.mkdirSync(path.join(staticDocsRoot, 'guide'), { recursive: true });
  fs.writeFileSync(path.join(staticDocsRoot, 'guide', 'start.md'), '# Start\n\nGo [home](/).');
  fs.mkdirSync(path.join(staticDocsRoot, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(staticDocsRoot, 'nested', 'index.md'), '# Nested\n\nNested landing page.');
  fs.mkdirSync(path.join(staticDocsRoot, 'internal'), { recursive: true });
  fs.writeFileSync(path.join(staticDocsRoot, 'internal', 'draft.md'), '# Draft\n\nDo not publish.');
  fs.mkdirSync(path.join(staticDocsRoot, 'public'), { recursive: true });
  fs.writeFileSync(path.join(staticDocsRoot, 'public', 'asset.txt'), 'asset');
  fs.writeFileSync(path.join(staticDocsRoot, 'public', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  fs.mkdirSync(path.join(staticDocsRoot, '.vitepress', 'dist'), { recursive: true });
  fs.writeFileSync(path.join(staticDocsRoot, '.vitepress', 'dist', 'stale.html'), 'stale output');

  await runStaticDocsBuild(staticTempRoot, ['build', 'docs']);

  const staticDist = path.join(staticDocsRoot, '.vitepress', 'dist');
  assert.equal(fs.existsSync(path.join(staticDist, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(staticDist, 'guide', 'start.html')), true);
  assert.equal(fs.existsSync(path.join(staticDist, 'nested', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(staticDist, 'internal', 'draft.html')), false);
  assert.equal(fs.existsSync(path.join(staticDist, 'stale.html')), false);
  assert.equal(fs.readFileSync(path.join(staticDist, 'asset.txt'), 'utf8'), 'asset');
  const fixtureIndex = fs.readFileSync(path.join(staticDist, 'index.html'), 'utf8');
  const fixtureGuide = fs.readFileSync(path.join(staticDist, 'guide', 'start.html'), 'utf8');
  assert.match(fixtureIndex, /Static Docs Fixture/);
  assert.match(
    fixtureIndex,
    /href="\/guide\/start\.html"/,
    'expected static docs build to rewrite clean internal links to generated html files',
  );
  assert.match(
    fixtureIndex,
    /href="\/guide\/start\.html#setup"/,
    'expected static docs build to preserve hashes while rewriting markdown source links to generated html files',
  );
  assert.match(
    fixtureIndex,
    /href="\/nested\/index\.html"/,
    'expected static docs build to rewrite directory clean URLs to generated index html files',
  );
  assert.match(
    fixtureGuide,
    /href="\/index\.html"/,
    'expected sidebar page links to be root-relative so nested pages do not resolve them under their own directory',
  );
  assert.match(
    fixtureGuide,
    /<h2>Guide<\/h2>[\s\S]*href="\/guide\/start\.html"/,
    'expected static docs build to render the curated sidebar section from siteConfig rather than filesystem-derived pages',
  );
  assert.doesNotMatch(
    fixtureGuide,
    /Nested Home/,
    'expected static docs build to avoid leaking unrelated filesystem pages into a section sidebar',
  );
  assert.deepEqual(verifyStaticDocsLinks(staticDist), []);

  fs.writeFileSync(
    path.join(staticDist, 'broken.html'),
    '<a href="/missing.html">Missing</a><img src="/missing.png">',
  );
  assert.deepEqual(
    verifyStaticDocsLinks(staticDist),
    [
      'broken.html -> /missing.html',
      'broken.html -> /missing.png',
    ],
    'expected static docs link verifier to report missing root-relative generated docs assets',
  );

  fs.rmSync(staticTempRoot, { recursive: true, force: true });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-vitepress-'));
  const distDir = path.join(tempRoot, 'docs', '.vitepress', 'dist');
  const staleFile = path.join(distDir, 'stale.html');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(staleFile, 'stale');

  maybeCleanVitepressDist(tempRoot, ['build', 'docs']);
  assert.equal(fs.existsSync(staleFile), false, 'expected build mode to remove stale docs dist output');

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(staleFile, 'stale');

  maybeCleanVitepressDist(tempRoot, ['dev', 'docs']);
  assert.equal(fs.existsSync(staleFile), true, 'expected non-build mode to preserve docs dist output');

  const pnpmStoreRoot = path.join(tempRoot, 'node_modules', '.pnpm');
  const cleanPackageDir = path.join(
    pnpmStoreRoot,
    'vitepress@1.6.4_test-clean',
    'node_modules',
    'vitepress',
  );
  const corruptPackageDir = path.join(
    pnpmStoreRoot,
    'vitepress@1.6.4_test-clean',
    'node_modules',
    'vitepress.bak-corrupt',
  );
  const corruptPackageLink = path.join(tempRoot, 'node_modules', 'vitepress');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';

  fs.mkdirSync(path.join(cleanPackageDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(cleanPackageDir, 'package.json'), '{"name":"vitepress"}');
  fs.writeFileSync(path.join(cleanPackageDir, 'bin', 'vitepress.js'), '#!/usr/bin/env node\n');

  fs.mkdirSync(path.join(corruptPackageDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(corruptPackageDir, 'package.json'), '{"name":"vitepress"}');
  fs.writeFileSync(path.join(corruptPackageDir, 'bin', 'vitepress.js'), '#!/usr/bin/env node\n');

  fs.mkdirSync(path.dirname(corruptPackageLink), { recursive: true });
  fs.symlinkSync(corruptPackageDir, corruptPackageLink, linkType);

  const repairedPackageLink = ensureVitepressPackageLink(tempRoot);

  assert.equal(
    fs.realpathSync(repairedPackageLink),
    fs.realpathSync(cleanPackageDir),
    'expected run-vitepress to replace backup-linked vitepress package paths with the canonical pnpm package link',
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
}

main().then(
  () => {
    console.log('ok - vitepress CLI path resolves for workspace docs commands');
  },
  (error) => {
    console.error('not ok - vitepress CLI path resolves for workspace docs commands');
    throw error;
  },
);
