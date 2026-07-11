import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';

import { repairPnpmFallbackLinks } from './repair-pnpm-fallback-links.mjs';

const nativeDocsConfigFile = 'siteConfig.mjs';

function slash(value) {
  return value.replace(/\\/g, '/');
}

function normalizeRelativeDocsPath(rootDir, absolutePath) {
  return slash(path.relative(rootDir, absolutePath));
}

function globToRegExp(pattern) {
  const normalizedPattern = slash(pattern);
  let source = '^';

  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const char = normalizedPattern[index];
    const nextChar = normalizedPattern[index + 1];
    if (char === '*' && nextChar === '*') {
      source += '.*';
      index += 1;
      continue;
    }
    if (char === '*') {
      source += '[^/]*';
      continue;
    }
    source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  return new RegExp(`${source}$`);
}

function isDocsPageExcluded(relativePath, excludePatterns = []) {
  return excludePatterns.some((pattern) => globToRegExp(pattern).test(relativePath));
}

function collectMarkdownPages(srcDir, excludePatterns) {
  const pages = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.vitepress') {
        continue;
      }

      const absolutePath = path.join(dir, entry.name);
      const relativePath = normalizeRelativeDocsPath(srcDir, absolutePath);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md') && !isDocsPageExcluded(relativePath, excludePatterns)) {
        pages.push(relativePath);
      }
    }
  };

  visit(srcDir);
  return pages.sort();
}

function realpathOrNull(candidate) {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

export function isUsableVitepressPackageDir(candidate) {
  if (!fs.existsSync(path.join(candidate, 'package.json'))) {
    return false;
  }

  const resolvedDir = realpathOrNull(candidate);
  if (!resolvedDir) {
    return false;
  }

  return path.basename(resolvedDir) === 'vitepress';
}

function findExistingPath(candidates) {
  return candidates.find((candidate) => isUsableVitepressPackageDir(candidate)) ?? null;
}

function collectVitepressCandidatesFromPnpmStore(pnpmStoreDir) {
  if (!fs.existsSync(pnpmStoreDir)) {
    return [];
  }

  return fs
    .readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vitepress@'))
    .map((entry) =>
      path.join(pnpmStoreDir, entry.name, 'node_modules', 'vitepress'),
    );
}

function collectWorkspaceFallbackVitepressCandidates(rootDir) {
  const worktreesDir = path.join(rootDir, '.worktrees');
  if (!fs.existsSync(worktreesDir)) {
    return [];
  }

  return fs
    .readdirSync(worktreesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const worktreeRootDir = path.join(worktreesDir, entry.name);
      return [
        path.join(worktreeRootDir, 'node_modules', 'vitepress'),
        ...collectVitepressCandidatesFromPnpmStore(
          path.join(worktreeRootDir, 'node_modules', '.pnpm'),
        ),
      ];
    });
}

export function resolveVitepressPackageDir(rootDir = process.cwd()) {
  const directPackageDir = path.join(rootDir, 'node_modules', 'vitepress');
  if (isUsableVitepressPackageDir(directPackageDir)) {
    return directPackageDir;
  }

  const resolvedPackageDir = findExistingPath([
    ...collectVitepressCandidatesFromPnpmStore(
      path.join(rootDir, 'node_modules', '.pnpm'),
    ),
    ...collectWorkspaceFallbackVitepressCandidates(rootDir),
  ]);
  if (!resolvedPackageDir) {
    throw new Error('Unable to resolve VitePress package from workspace or fallback store entries.');
  }

  return resolvedPackageDir;
}

export function resolveVitepressCli(rootDir = process.cwd()) {
  return path.join(ensureVitepressPackageLink(rootDir), 'bin', 'vitepress.js');
}

export function ensureVitepressPackageLink(rootDir = process.cwd()) {
  const packageDir = resolveVitepressPackageDir(rootDir);
  const packageLinkPath = path.join(rootDir, 'node_modules', 'vitepress');

  if (isUsableVitepressPackageDir(packageLinkPath)) {
    return packageLinkPath;
  }

  fs.mkdirSync(path.dirname(packageLinkPath), { recursive: true });

  if (fs.existsSync(packageLinkPath)) {
    fs.rmSync(packageLinkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(
    packageDir,
    packageLinkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  return packageLinkPath;
}

export function maybeCleanVitepressDist(rootDir = process.cwd(), cliArgs = process.argv.slice(2)) {
  const [command, siteDir] = cliArgs;
  if (command !== 'build' || !siteDir) {
    return null;
  }

  const distDir = path.join(rootDir, siteDir, '.vitepress', 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  return distDir;
}

export async function prepareVitepressEnvironment(rootDir = process.cwd()) {
  await repairPnpmFallbackLinks({
    workspaceRootDir: rootDir,
  });
  ensureVitepressPackageLink(rootDir);
}

export function isStaticDocsBuildCommand(cliArgs = process.argv.slice(2)) {
  const [command, siteDir] = cliArgs;
  return command === 'build' && siteDir === 'docs';
}

function resolveNativeDocsConfigPath(rootDir = process.cwd(), siteDir = 'docs') {
  return path.join(rootDir, siteDir, '.vitepress', nativeDocsConfigFile);
}

export async function loadNativeDocsUserConfig(rootDir = process.cwd(), siteDir = 'docs') {
  const configPath = resolveNativeDocsConfigPath(rootDir, siteDir);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing native docs config: ${configPath}`);
  }

  const configModule = await import(pathToFileURL(configPath).href);
  const userConfig = configModule.default;
  if (!userConfig || typeof userConfig !== 'object') {
    throw new Error(`Native docs config must default-export an object: ${configPath}`);
  }

  return { configPath, userConfig };
}

function readFrontmatter(markdown) {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    return { data: {}, body: markdown };
  }

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) {
    return { data: {}, body: markdown };
  }

  return {
    data: parseSimpleYaml(match[1]),
    body: markdown.slice(match[0].length),
  };
}

export function parseSimpleYaml(source) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = source.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) {
      continue;
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const line = rawLine.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) {
      stack.pop();
    }

    const parent = stack.at(-1).value;
    if (line.startsWith('- ')) {
      if (!Array.isArray(parent)) {
        continue;
      }

      const itemSource = line.slice(2);
      if (itemSource.includes(':')) {
        const item = {};
        parent.push(item);
        assignYamlKeyValue(item, itemSource);
        stack.push({ indent, value: item });
      } else {
        parent.push(parseYamlScalar(itemSource));
      }
      continue;
    }

    const keyMatch = /^([^:]+):(.*)$/.exec(line);
    if (!keyMatch || Array.isArray(parent)) {
      continue;
    }

    const key = keyMatch[1].trim();
    const rawValue = keyMatch[2].trim();
    if (rawValue) {
      parent[key] = parseYamlScalar(rawValue);
      continue;
    }

    const nextLine = lines[lineIndex + 1] ?? '';
    const container = nextLine.trim().startsWith('- ') ? [] : {};
    parent[key] = container;
    stack.push({ indent, value: container });
  }

  return root;
}

function assignYamlKeyValue(target, source) {
  const keyMatch = /^([^:]+):(.*)$/.exec(source);
  if (!keyMatch) {
    return;
  }

  target[keyMatch[1].trim()] = parseYamlScalar(keyMatch[2].trim());
}

function parseYamlScalar(value) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function extractTitle(markdownBody, frontmatter, fallback) {
  if (frontmatter.title) {
    return String(frontmatter.title);
  }

  const heading = /^#\s+(.+)$/m.exec(markdownBody);
  return heading ? heading[1].trim() : fallback;
}

function pageUrlFromRelativePath(relativePath, cleanUrls = true) {
  const normalized = slash(relativePath);
  if (normalized === 'index.md') {
    return '/';
  }

  const withoutExtension = normalized.replace(/\.md$/, '');
  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}/`;
  }

  return cleanUrls ? `/${withoutExtension}` : `/${withoutExtension}.html`;
}

function pageHrefFromRelativePath(relativePath) {
  const normalized = slash(relativePath);
  if (normalized === 'index.md') {
    return '/index.html';
  }

  if (normalized.endsWith('/index.md')) {
    return `/${normalized.replace(/\/index\.md$/, '/index.html')}`;
  }

  return `/${normalized.replace(/\.md$/, '.html')}`;
}

function outputPathFromRelativePath(distDir, relativePath) {
  const normalized = slash(relativePath);
  if (normalized === 'index.md') {
    return path.join(distDir, 'index.html');
  }

  return path.join(distDir, normalized.replace(/\.md$/, '.html'));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitHref(link) {
  const hashIndex = link.indexOf('#');
  if (hashIndex === -1) {
    return { pathPart: link, hashPart: '' };
  }

  return {
    pathPart: link.slice(0, hashIndex),
    hashPart: link.slice(hashIndex),
  };
}

function normalizeLink(link) {
  if (!link || /^(?:[a-z]+:|\/\/|#)/i.test(link)) {
    return link;
  }

  const { pathPart, hashPart } = splitHref(link);
  if (pathPart.endsWith('.md')) {
    return `${pathPart.replace(/\.md$/, '.html')}${hashPart}`;
  }

  if (pathPart === '/') {
    return `/index.html${hashPart}`;
  }

  if (pathPart.startsWith('/') && !path.posix.extname(pathPart)) {
    const htmlPath = pathPart.endsWith('/')
      ? `${pathPart}index.html`
      : `${pathPart}.html`;
    return `${htmlPath}${hashPart}`;
  }

  return link;
}

function buildNavItems(config) {
  return config.locales?.root?.themeConfig?.nav
    ?? config.themeConfig?.nav
    ?? [];
}

function buildSidebarConfig(config) {
  return config.locales?.root?.themeConfig?.sidebar
    ?? config.themeConfig?.sidebar
    ?? {};
}

function flattenSidebarItems(items = []) {
  return items.flatMap((item) => {
    if (Array.isArray(item.items)) {
      return flattenSidebarItems(item.items);
    }

    return item.link ? [item] : [];
  });
}

function findSidebarGroups(config, pageUrl) {
  const sidebarConfig = buildSidebarConfig(config);
  const prefixes = Object.keys(sidebarConfig).sort((left, right) => right.length - left.length);
  const matchedPrefix = prefixes.find((prefix) => pageUrl.startsWith(prefix));
  if (!matchedPrefix) {
    return [];
  }

  return sidebarConfig[matchedPrefix] ?? [];
}

function renderSidebar(config, pageUrl) {
  const groups = findSidebarGroups(config, pageUrl);
  if (groups.length === 0) {
    return [
      '<h2>Navigation</h2>',
      buildNavItems(config)
        .map((item) => `<a href="${escapeHtml(normalizeLink(item.link))}">${escapeHtml(item.text)}</a>`)
        .join(''),
    ].join('\n');
  }

  return groups
    .map((group) => [
      `<h2>${escapeHtml(group.text ?? 'Pages')}</h2>`,
      flattenSidebarItems(group.items ?? [])
        .map((item) => `<a href="${escapeHtml(normalizeLink(item.link))}">${escapeHtml(item.text)}</a>`)
        .join(''),
    ].join('\n'))
    .join('\n');
}

function rewriteRenderedHtmlLinks(html) {
  return html.replace(
    /(<a\b[^>]*\bhref=")([^"]+)(")/g,
    (_match, before, href, after) => `${before}${escapeHtml(normalizeLink(href))}${after}`,
  );
}

function renderNav(config) {
  const items = buildNavItems(config);
  return items
    .map((item) => `<a href="${escapeHtml(normalizeLink(item.link))}">${escapeHtml(item.text)}</a>`)
    .join('');
}

function resolveLogoHref(config) {
  return config.themeConfig?.logo
    ?? config.locales?.root?.themeConfig?.logo
    ?? '';
}

function renderPage({
  config,
  markdown,
  page,
  pages,
  rootDir,
}) {
  const { data: frontmatter, body } = readFrontmatter(markdown);
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
  const renderedBody = md.render(body);
  const renderedBodyWithLinks = rewriteRenderedHtmlLinks(renderedBody);
  const title = extractTitle(body, frontmatter, config.title);
  const pageUrl = pageUrlFromRelativePath(page.relativePath, config.cleanUrls);
  const logoHref = resolveLogoHref(config);
  const searchJson = JSON.stringify(
    pages.map((entry) => ({
      title: entry.title,
      url: entry.url,
    })),
  );

  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(page.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)} | ${escapeHtml(config.title)}</title>`,
    `<meta name="description" content="${escapeHtml(config.description ?? '')}">`,
    logoHref ? `<link rel="icon" href="${escapeHtml(normalizeLink(logoHref))}">` : '',
    '<style>',
    'body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f7f9fb;line-height:1.6;}',
    'header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px 32px;border-bottom:1px solid #d9e2ec;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);}',
    '.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:#0f766e;text-decoration:none;}',
    '.brand img{width:28px;height:28px;}nav{display:flex;flex-wrap:wrap;gap:14px;}nav a{color:#405166;text-decoration:none;font-size:14px;}nav a:hover{color:#0f766e;}',
    '.layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:32px;max-width:1180px;margin:0 auto;padding:38px 28px 64px;}',
    'main{min-width:0;background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:34px;box-shadow:0 10px 30px rgba(15,23,42,.05);}',
    'aside{align-self:start;position:sticky;top:82px;background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:18px;}',
    'aside h2{margin:0 0 12px;font-size:14px;color:#526173;text-transform:uppercase;}aside a{display:block;padding:7px 0;color:#405166;text-decoration:none;font-size:14px;}aside a:hover{color:#0f766e;}',
    'h1,h2,h3{line-height:1.25;color:#111827;}h1{font-size:38px;margin-top:0;}h2{margin-top:34px;border-top:1px solid #e6edf3;padding-top:24px;}',
    'a{color:#0f766e;}code{background:#edf3f7;border-radius:4px;padding:2px 5px;}pre{overflow:auto;background:#111827;color:#e5e7eb;border-radius:8px;padding:18px;}pre code{background:transparent;color:inherit;padding:0;}',
    'blockquote{margin:24px 0;padding:14px 18px;border-left:4px solid #0f766e;background:#eef8f6;color:#405166;}table{width:100%;border-collapse:collapse;display:block;overflow:auto;}th,td{border:1px solid #d9e2ec;padding:8px 10px;}th{background:#f1f5f9;text-align:left;}',
    '.home-hero{margin:-34px -34px 32px;padding:48px 34px;background:linear-gradient(135deg,#0f766e,#1f4f82);color:#fff;border-radius:8px 8px 0 0;}.home-hero h1{color:#fff;margin:0 0 12px;}.home-hero p{max-width:780px;color:#e8fffb;font-size:18px;}',
    '@media (max-width:900px){header{padding:14px 18px;align-items:flex-start;flex-direction:column}.layout{display:block;padding:22px 14px}.layout aside{position:static;margin-top:20px}main{padding:24px}.home-hero{margin:-24px -24px 28px;padding:34px 24px}h1{font-size:30px}}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<a class="brand" href="/index.html">${logoHref ? `<img src="${escapeHtml(normalizeLink(logoHref))}" alt="">` : ''}${escapeHtml(config.title)}</a>`,
    `<nav>${renderNav(config)}</nav>`,
    '</header>',
    '<div class="layout">',
    '<main>',
    renderHomeHero(frontmatter),
    renderedBodyWithLinks,
    '</main>',
    '<aside>',
    renderSidebar(config, pageUrl),
    '</aside>',
    '</div>',
    `<script type="application/json" id="search-index">${escapeHtml(searchJson)}</script>`,
    `<!-- built by scripts/run-vitepress.mjs from ${escapeHtml(normalizeRelativeDocsPath(rootDir, page.absolutePath))} -->`,
    '</body>',
    '</html>',
  ].join('\n');
}

function renderHomeHero(frontmatter) {
  if (frontmatter.layout !== 'home' || !frontmatter.hero) {
    return '';
  }

  const hero = frontmatter.hero;
  return [
    '<section class="home-hero">',
    `<h1>${escapeHtml(hero.name ?? 'Agent Studio')}</h1>`,
    hero.text ? `<p>${escapeHtml(hero.text)}</p>` : '',
    hero.tagline ? `<p>${escapeHtml(hero.tagline)}</p>` : '',
    '</section>',
  ].join('');
}

function copyPublicAssets(srcDir, distDir) {
  const publicDir = path.join(srcDir, 'public');
  if (!fs.existsSync(publicDir)) {
    return;
  }

  fs.cpSync(publicDir, distDir, { recursive: true });
}

function normalizeStaticDocsLinkTarget(link) {
  if (!link || /^(?:[a-z]+:|\/\/|#)/i.test(link)) {
    return '';
  }

  const { pathPart } = splitHref(link);
  if (!pathPart.startsWith('/')) {
    return '';
  }

  return decodeURIComponent(pathPart.replace(/^\//, ''));
}

export function verifyStaticDocsLinks(distDir) {
  const missingLinks = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.html')) {
        continue;
      }

      const relativePagePath = normalizeRelativeDocsPath(distDir, absolutePath);
      const html = fs.readFileSync(absolutePath, 'utf8');
      for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
        const linkTarget = normalizeStaticDocsLinkTarget(match[1]);
        if (!linkTarget) {
          continue;
        }

        const targetPath = path.join(distDir, linkTarget);
        if (!fs.existsSync(targetPath)) {
          missingLinks.push(`${relativePagePath} -> ${match[1]}`);
        }
      }
    }
  };

  visit(distDir);
  return missingLinks.sort();
}

export async function runStaticDocsBuild(rootDir = process.cwd(), cliArgs = process.argv.slice(2)) {
  const [, siteDir = 'docs'] = cliArgs;
  const srcDir = path.join(rootDir, siteDir);
  const distDir = path.join(srcDir, '.vitepress', 'dist');
  const { userConfig } = await loadNativeDocsUserConfig(rootDir, siteDir);
  const pagePaths = collectMarkdownPages(srcDir, userConfig.srcExclude ?? []);

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  copyPublicAssets(srcDir, distDir);

  const preparedPages = pagePaths.map((relativePath) => {
    const absolutePath = path.join(srcDir, relativePath);
    const markdown = fs.readFileSync(absolutePath, 'utf8');
    const { data: frontmatter, body } = readFrontmatter(markdown);
    const lang = relativePath.startsWith('zh-CN/') ? 'zh-CN' : 'en-US';
    return {
      absolutePath,
      body,
      href: pageHrefFromRelativePath(relativePath),
      lang,
      markdown,
      relativePath,
      title: extractTitle(body, frontmatter, userConfig.title),
      url: pageUrlFromRelativePath(relativePath, userConfig.cleanUrls),
    };
  });

  for (const page of preparedPages) {
    const outputPath = outputPathFromRelativePath(distDir, page.relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      renderPage({
        config: userConfig,
        markdown: page.markdown,
        page,
        pages: preparedPages,
        rootDir,
      }),
    );
  }

  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, path.join(distDir, '404.html'));
  }

  fs.writeFileSync(
    path.join(distDir, 'search-index.json'),
    `${JSON.stringify(
      preparedPages.map((page) => ({
        title: page.title,
        url: page.url,
        text: stripHtml(new MarkdownIt().render(page.body)).slice(0, 2000),
      })),
      null,
      2,
    )}\n`,
  );

  const missingLinks = verifyStaticDocsLinks(distDir);
  if (missingLinks.length > 0) {
    throw new Error(
      [
        `Static docs build generated ${missingLinks.length} missing internal link(s):`,
        ...missingLinks.slice(0, 20).map((entry) => `- ${entry}`),
      ].join('\n'),
    );
  }

  console.log(`[run-vitepress] built static docs site with ${preparedPages.length} pages at ${distDir}`);
}

async function main() {
  const rootDir = process.cwd();
  await prepareVitepressEnvironment(rootDir);
  const cliArgs = process.argv.slice(2);
  maybeCleanVitepressDist(rootDir, cliArgs);
  if (isStaticDocsBuildCommand(cliArgs)) {
    await runStaticDocsBuild(rootDir, cliArgs);
    return;
  }

  const vitepressCli = resolveVitepressCli(rootDir);
  const child = spawn(process.execPath, [vitepressCli, ...cliArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (error) => {
    console.error(`[run-vitepress] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryUrl === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
