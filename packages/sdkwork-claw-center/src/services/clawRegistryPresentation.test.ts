import assert from 'node:assert/strict';
import type { ClawRegistryEntry } from '../types';
import {
  buildRegistryConnectCommand,
  createRegistryCatalog,
  createRegistrySearchSuggestions,
  selectLatestRegistryEntries,
  selectPopularRegistryEntries,
  selectRecommendedRegistryEntries,
  selectRegistrySpotlight,
  resolveRegistryQuickConnectAction,
} from './clawRegistryPresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createEntry(overrides: Partial<ClawRegistryEntry> = {}): ClawRegistryEntry {
  return {
    id: 'registry-default',
    slug: 'registry-default',
    name: 'Codex Routing Hub',
    category: 'Engineering',
    kind: 'agent',
    summary: 'Route engineering issues to specialist OpenClaw agents.',
    description: 'Multi-agent engineering registry entry with coding and review specializations.',
    tags: ['code', 'review'],
    capabilities: ['routing', 'debugging'],
    searchTerms: ['engineering', 'routing'],
    verified: true,
    featured: false,
    matchCount: 4200,
    activeAgents: 128,
    region: 'global',
    latency: '<120ms',
    updatedAt: '2026-03-20T08:00:00.000Z',
    serviceModes: ['ACP'],
    bestFor: ['Bug fixing'],
    integrations: ['GitHub'],
    connection: {
      websocketUrl: 'wss://registry.openclaw.dev/gateway/codex-routing',
      authMode: 'token',
      tokenPlaceholder: '<registry-token>',
      defaultSession: 'agent:main:main',
    },
    ...overrides,
  };
}

await runTest('createRegistryCatalog preserves preferred category order and appends custom categories', () => {
  const catalog = createRegistryCatalog({
    entries: [
      createEntry({ id: 'engineering', category: 'Engineering' }),
      createEntry({ id: 'research', category: 'Research' }),
      createEntry({ id: 'custom', category: 'Healthcare' }),
    ],
    keyword: '',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.categories, ['All', 'Engineering', 'Research', 'Healthcare']);
});

await runTest('createRegistryCatalog filters by keyword across discovery fields', () => {
  const catalog = createRegistryCatalog({
    entries: [
      createEntry({
        id: 'ops',
        name: 'Ops Recovery Grid',
        category: 'Operations',
        tags: ['incident', 'rollback'],
        capabilities: ['containment'],
      }),
      createEntry({
        id: 'research',
        name: 'Research Scout',
        category: 'Research',
        tags: ['citations'],
        capabilities: ['evidence gathering'],
      }),
    ],
    keyword: 'rollback',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.entries.map((entry) => entry.id), ['ops']);
});

await runTest('createRegistryCatalog filters by category independently from keyword matching', () => {
  const catalog = createRegistryCatalog({
    entries: [
      createEntry({ id: 'eng', category: 'Engineering', name: 'Build Smith' }),
      createEntry({ id: 'support', category: 'Support', name: 'Support Escalator' }),
    ],
    keyword: '',
    activeCategory: 'Support',
  });

  assert.deepEqual(catalog.entries.map((entry) => entry.id), ['support']);
});

await runTest('createRegistryCatalog ranks stronger search matches ahead of generic featured matches', () => {
  const catalog = createRegistryCatalog({
    entries: [
      createEntry({
        id: 'weak-incident',
        name: 'Workflow Autopilot',
        featured: true,
        summary: 'Coordinates repeatable incident follow-up loops.',
        capabilities: ['automation'],
        searchTerms: ['workflow'],
      }),
      createEntry({
        id: 'strong-incident',
        name: 'Incident Response Mesh',
        featured: false,
        summary: 'Incident response agent for runtime containment.',
        capabilities: ['incident triage', 'rollback sequencing'],
        searchTerms: ['incident', 'operations'],
      }),
    ],
    keyword: 'incident',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.entries.map((entry) => entry.id), ['strong-incident', 'weak-incident']);
  assert.ok(catalog.entries[0]?.searchScore > catalog.entries[1]?.searchScore);
});

await runTest('createRegistryCatalog exposes match reasons for query-backed discovery results', () => {
  const catalog = createRegistryCatalog({
    entries: [
      createEntry({
        id: 'research-grid',
        name: 'Research Scout Grid',
        capabilities: ['evidence gathering', 'source comparison'],
        bestFor: ['market scans'],
        searchTerms: ['citations', 'evidence'],
      }),
    ],
    keyword: 'evidence',
    activeCategory: 'All',
  });

  assert.deepEqual(catalog.entries[0]?.matchReasons, ['evidence gathering', 'evidence']);
});

await runTest('selectRegistrySpotlight prefers featured and stronger match density', () => {
  const spotlight = selectRegistrySpotlight([
    createEntry({ id: 'baseline', featured: false, verified: true, matchCount: 3000 }),
    createEntry({ id: 'featured', featured: true, verified: true, matchCount: 1500 }),
    createEntry({ id: 'high-match', featured: false, verified: true, matchCount: 9000 }),
    createEntry({ id: 'unverified', featured: true, verified: false, matchCount: 6000 }),
  ]);

  assert.deepEqual(spotlight.map((entry) => entry.id), ['featured', 'unverified', 'high-match']);
});

await runTest('selectLatestRegistryEntries orders registry entries by freshest update time first', () => {
  const latest = selectLatestRegistryEntries([
    createEntry({ id: 'older', updatedAt: '2026-03-18T10:00:00.000Z' }),
    createEntry({ id: 'newest', updatedAt: '2026-03-22T09:00:00.000Z' }),
    createEntry({ id: 'middle', updatedAt: '2026-03-20T09:00:00.000Z' }),
  ]);

  assert.deepEqual(latest.map((entry) => entry.id), ['newest', 'middle', 'older']);
});

await runTest('selectPopularRegistryEntries ranks by successful matches and active agents', () => {
  const popular = selectPopularRegistryEntries([
    createEntry({ id: 'baseline', matchCount: 2200, activeAgents: 140 }),
    createEntry({ id: 'top', matchCount: 9900, activeAgents: 680 }),
    createEntry({ id: 'runner-up', matchCount: 6100, activeAgents: 540 }),
  ]);

  assert.deepEqual(popular.map((entry) => entry.id), ['top', 'runner-up', 'baseline']);
});

await runTest('selectRecommendedRegistryEntries keeps featured verified entries at the top', () => {
  const recommended = selectRecommendedRegistryEntries([
    createEntry({ id: 'unverified-featured', featured: true, verified: false, matchCount: 8000 }),
    createEntry({ id: 'verified-featured', featured: true, verified: true, matchCount: 4200 }),
    createEntry({ id: 'verified-plain', featured: false, verified: true, matchCount: 9300 }),
  ]);

  assert.deepEqual(recommended.map((entry) => entry.id), [
    'verified-featured',
    'unverified-featured',
    'verified-plain',
  ]);
});

await runTest('createRegistrySearchSuggestions keeps featured discovery intents first and removes duplicates', () => {
  const suggestions = createRegistrySearchSuggestions([
    createEntry({
      id: 'featured-entry',
      featured: true,
      bestFor: ['feature delivery', 'incident response'],
      capabilities: ['code review', 'parallel work'],
      tags: ['release'],
    }),
    createEntry({
      id: 'support-entry',
      featured: false,
      bestFor: ['incident response', 'case triage'],
      capabilities: ['context gathering'],
      tags: ['support'],
    }),
  ]);

  assert.deepEqual(suggestions.slice(0, 6), [
    'feature delivery',
    'incident response',
    'code review',
    'parallel work',
    'release',
    'case triage',
  ]);
});

await runTest('resolveRegistryQuickConnectAction sends gateway-ready openclaw instances to chat', () => {
  const action = resolveRegistryQuickConnectAction([
    {
      id: 'instance-openclaw',
      runtimeKind: 'openclaw',
      status: 'online',
      transportKind: 'openclawGatewayWs',
      baseUrl: 'http://127.0.0.1:21280',
      websocketUrl: 'ws://127.0.0.1:21280',
    },
  ]);

  assert.deepEqual(action, {
    kind: 'chat',
    to: '/chat',
    instanceId: 'instance-openclaw',
  });
});

await runTest('resolveRegistryQuickConnectAction sends any gateway-ready instance to chat even when runtimeKind is custom', () => {
  const action = resolveRegistryQuickConnectAction([
    {
      id: 'instance-custom-gateway',
      runtimeKind: 'custom',
      status: 'online',
      transportKind: 'openclawGatewayWs',
      baseUrl: 'http://127.0.0.1:28789',
      websocketUrl: 'ws://127.0.0.1:28789',
    },
  ]);

  assert.deepEqual(action, {
    kind: 'chat',
    to: '/chat',
    instanceId: 'instance-custom-gateway',
  });
});

await runTest('resolveRegistryQuickConnectAction falls back to instance detail when a gateway-capable instance exists but is not gateway ready', () => {
  const action = resolveRegistryQuickConnectAction([
    {
      id: 'instance-custom-gateway',
      runtimeKind: 'custom',
      status: 'offline',
      transportKind: 'openclawGatewayWs',
      baseUrl: null,
      websocketUrl: null,
    },
  ]);

  assert.deepEqual(action, {
    kind: 'instance',
    to: '/instances/instance-custom-gateway',
    instanceId: 'instance-custom-gateway',
  });
});

await runTest('resolveRegistryQuickConnectAction points to docs when no openclaw instance exists', () => {
  const action = resolveRegistryQuickConnectAction([
    {
      id: 'custom-http',
      runtimeKind: 'custom',
      status: 'online',
      transportKind: 'customHttp',
      baseUrl: 'http://127.0.0.1:3000',
      websocketUrl: null,
    },
  ]);

  assert.deepEqual(action, {
    kind: 'install',
    to: '/docs#script',
    instanceId: null,
  });
});

await runTest('buildRegistryConnectCommand emits an ACP command with token placeholder and session key', () => {
  const command = buildRegistryConnectCommand(
    createEntry({
      connection: {
        websocketUrl: 'wss://registry.openclaw.dev/gateway/research-scout',
        authMode: 'token',
        tokenPlaceholder: '<research-token>',
        defaultSession: 'agent:research:main',
      },
    }),
  );

  assert.equal(
    command,
    'openclaw acp --url wss://registry.openclaw.dev/gateway/research-scout --token <research-token> --session agent:research:main',
  );
});
