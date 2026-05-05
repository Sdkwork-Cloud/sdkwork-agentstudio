import { localSearchOptions, publicDocsSrcExclude } from './searchIndexPolicy.mjs';

const enNav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Architecture', link: '/core/architecture' },
  { text: 'API Reference', link: '/reference/api-reference' },
  { text: 'Reference', link: '/reference/commands' },
  { text: 'Contributing', link: '/contributing/' },
];

const zhNav = [
  { text: 'Guide', link: '/zh-CN/guide/getting-started' },
  { text: 'Architecture', link: '/zh-CN/core/architecture' },
  { text: 'API Reference', link: '/zh-CN/reference/api-reference' },
  { text: 'Reference', link: '/zh-CN/reference/commands' },
  { text: 'Contributing', link: '/zh-CN/contributing/' },
];

const enSidebar = {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Application Modes', link: '/guide/application-modes' },
        { text: 'Install And Deploy', link: '/guide/install-and-deploy' },
        { text: 'Development', link: '/guide/development' },
      ],
    },
  ],
  '/core/': [
    {
      text: 'Architecture',
      items: [
        { text: 'Architecture', link: '/core/architecture' },
        { text: 'Packages', link: '/core/packages' },
        { text: 'Desktop Runtime', link: '/core/desktop' },
        { text: 'Release And Deployment', link: '/core/release-and-deployment' },
      ],
    },
  ],
  '/reference/': [
    {
      text: 'API Reference',
      items: [
        { text: 'API Overview', link: '/reference/api-reference' },
        { text: 'Claw Server Runtime', link: '/reference/claw-server-runtime' },
        { text: 'Claw Rollout API', link: '/reference/claw-rollout-api' },
      ],
    },
    {
      text: 'Operations Reference',
      items: [
        { text: 'Commands', link: '/reference/commands' },
        { text: 'Environment', link: '/reference/environment' },
        { text: 'Upstream Integration', link: '/reference/upstream-integration' },
      ],
    },
  ],
  '/contributing/': [
    {
      text: 'Contributing',
      items: [{ text: 'Contributor Guide', link: '/contributing/' }],
    },
  ],
};

const zhSidebar = {
  '/zh-CN/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/zh-CN/guide/getting-started' },
        { text: 'Application Modes', link: '/zh-CN/guide/application-modes' },
        { text: 'Install And Deploy', link: '/zh-CN/guide/install-and-deploy' },
        { text: 'Development', link: '/zh-CN/guide/development' },
      ],
    },
  ],
  '/zh-CN/core/': [
    {
      text: 'Architecture',
      items: [
        { text: 'Architecture', link: '/zh-CN/core/architecture' },
        { text: 'Packages', link: '/zh-CN/core/packages' },
        { text: 'Desktop Runtime', link: '/zh-CN/core/desktop' },
        { text: 'Release And Deployment', link: '/zh-CN/core/release-and-deployment' },
      ],
    },
  ],
  '/zh-CN/reference/': [
    {
      text: 'API Reference',
      items: [
        { text: 'API Overview', link: '/zh-CN/reference/api-reference' },
        { text: 'Claw Server Runtime', link: '/zh-CN/reference/claw-server-runtime' },
        { text: 'Claw Rollout API', link: '/zh-CN/reference/claw-rollout-api' },
      ],
    },
    {
      text: 'Operations Reference',
      items: [
        { text: 'Commands', link: '/zh-CN/reference/commands' },
        { text: 'Environment', link: '/zh-CN/reference/environment' },
        { text: 'Upstream Integration', link: '/zh-CN/reference/upstream-integration' },
      ],
    },
  ],
  '/zh-CN/contributing/': [
    {
      text: 'Contributing',
      items: [{ text: 'Contributor Guide', link: '/zh-CN/contributing/' }],
    },
  ],
};

export default {
  title: 'Claw Studio',
  description:
    'Official Claw Studio documentation for web, desktop, native server, container, and Kubernetes deployment modes.',
  cleanUrls: true,
  lastUpdated: false,
  srcExclude: publicDocsSrcExclude,
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Claw Studio' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Official Claw Studio documentation for the package-first workspace, native control plane, and release system.',
      },
    ],
    ['meta', { property: 'og:image', content: '/social-card.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    search: {
      provider: 'local',
      options: localSearchOptions,
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
        footer: {
          message: 'Built for a package-first Claw Studio workspace and unified host platform.',
          copyright: 'Copyright (c) 2026 Claw Studio contributors',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language',
      },
    },
    'zh-CN': {
      label: 'Chinese',
      lang: 'zh-CN',
      link: '/zh-CN/',
      description:
        'Official Claw Studio documentation for web, desktop, native server, container, and Kubernetes deployment modes.',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
        footer: {
          message: 'Built for a package-first Claw Studio workspace and unified host platform.',
          copyright: 'Copyright (c) 2026 Claw Studio contributors',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language',
      },
    },
  },
};
