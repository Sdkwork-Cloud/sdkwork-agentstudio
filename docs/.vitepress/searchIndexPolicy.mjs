const legacyMojibakeArchitectureDir = String.fromCodePoint(0x67b6, 0x6784);

const internalDocsPrefixes = [
  'community/',
  'prompts/',
  'release/',
  'reports/',
  'review/',
  'step/',
  'plans/',
  'superpowers/',
  'zh-CN/community/',
  'zh-CN/prompts/',
  'zh-CN/release/',
  'zh-CN/reports/',
  'zh-CN/review/',
  'zh-CN/step/',
  'zh-CN/plans/',
  'zh-CN/superpowers/',
  `${legacyMojibakeArchitectureDir}/`,
];

export const publicDocsSrcExclude = internalDocsPrefixes.map((prefix) => `${prefix}**`);

export function normalizeSearchPagePath(relativePath) {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function shouldIndexSearchPage(relativePath) {
  const normalizedPath = normalizeSearchPagePath(relativePath);
  return !internalDocsPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

export const localSearchOptions = {
  _render(src, env, md) {
    if (!shouldIndexSearchPage(env.relativePath ?? '')) {
      return '';
    }

    const html = md.render(src, env);
    return env.frontmatter?.search === false ? '' : html;
  },
};
