import assert from 'node:assert/strict';
import type { UsageWorkspaceSession } from '../types/usage.ts';
import {
  addUsageWorkspaceQueryToken,
  applyShiftRangeSelection,
  applyUsageWorkspaceQuerySuggestion,
  buildUsageWorkspaceQuerySuggestions,
  filterUsageWorkspaceLogs,
  filterUsageWorkspaceSessionsByQuery,
  parseUsageWorkspaceLogTools,
  removeUsageWorkspaceQueryToken,
  setUsageWorkspaceQueryTokensForKey,
} from './usageWorkspaceFilters.ts';

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

function buildSession(overrides: Partial<UsageWorkspaceSession> = {}): UsageWorkspaceSession {
  return {
    key: 'session-1',
    label: 'Incident review',
    sessionId: 'session-1-id',
    agentId: 'ops-agent',
    channel: 'slack',
    modelProvider: 'anthropic',
    providerOverride: undefined,
    model: 'claude-4.1',
    modelOverride: undefined,
    updatedAt: Date.UTC(2026, 3, 7, 10, 0, 0),
    usage: {
      sessionId: 'session-1-id',
      firstActivity: Date.UTC(2026, 3, 7, 9, 0, 0),
      lastActivity: Date.UTC(2026, 3, 7, 10, 0, 0),
      durationMs: 3_600_000,
      activityDates: ['2026-04-07'],
      input: 1200,
      output: 900,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2100,
      totalCost: 3.42,
      inputCost: 1.71,
      outputCost: 1.71,
      cacheReadCost: 0,
      cacheWriteCost: 0,
      missingCostEntries: 0,
      messageCounts: {
        total: 8,
        user: 4,
        assistant: 3,
        toolCalls: 2,
        toolResults: 1,
        errors: 1,
      },
      toolUsage: {
        totalCalls: 2,
        uniqueTools: 2,
        tools: [
          { name: 'grep', count: 1 },
          { name: 'read_file', count: 1 },
        ],
      },
      modelUsage: [{ provider: 'anthropic', model: 'claude-4.1', count: 1, totals: {
        input: 1200,
        output: 900,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2100,
        totalCost: 3.42,
        inputCost: 1.71,
        outputCost: 1.71,
        cacheReadCost: 0,
        cacheWriteCost: 0,
        missingCostEntries: 0,
      } }],
      latency: null,
    },
    ...overrides,
  };
}

await runTest('usage workspace query filters sessions by key, provider, tool, and numeric range', () => {
  const sessions = [
    buildSession(),
    buildSession({
      key: 'session-2',
      label: 'Daily rollout',
      sessionId: 'session-2-id',
      agentId: 'release-agent',
      channel: 'email',
      modelProvider: 'openai',
      model: 'gpt-5.1',
      usage: buildSession().usage
        ? {
            ...buildSession().usage!,
            totalTokens: 480,
            totalCost: 0.32,
            messageCounts: {
              ...buildSession().usage!.messageCounts,
              total: 3,
              errors: 0,
            },
            toolUsage: {
              totalCalls: 0,
              uniqueTools: 0,
              tools: [],
            },
            modelUsage: [],
          }
        : null,
    }),
  ];

  const filtered = filterUsageWorkspaceSessionsByQuery(
    sessions,
    'provider:anthropic tool:grep minTokens:1000 has:errors',
  );

  assert.deepEqual(
    filtered.sessions.map((session) => session.key),
    ['session-1'],
  );
  assert.deepEqual(filtered.warnings, []);
});

await runTest('usage workspace query returns warnings for unsupported keys and invalid numeric filters', () => {
  const filtered = filterUsageWorkspaceSessionsByQuery(
    [buildSession()],
    'region:cn minTokens:not-a-number',
  );

  assert.deepEqual(filtered.sessions.map((session) => session.key), ['session-1']);
  assert.deepEqual(filtered.warnings, ['Unknown filter: region', 'Invalid number for minTokens']);
});

await runTest('usage workspace query helpers build suggestions and mutate tokenized drafts', () => {
  const suggestions = buildUsageWorkspaceQuerySuggestions('pro', [buildSession()], {
    messages: { total: 0, user: 0, assistant: 0, toolCalls: 0, toolResults: 0, errors: 0 },
    tools: { totalCalls: 2, uniqueTools: 2, tools: [{ name: 'grep', count: 1 }] },
    byModel: [],
    byProvider: [{ provider: 'anthropic', count: 1, totals: buildSession().usage! }],
    byAgent: [],
    byChannel: [],
    daily: [],
  });

  assert.ok(suggestions.some((entry) => entry.value === 'provider:'));
  assert.equal(addUsageWorkspaceQueryToken('', 'provider:anthropic'), 'provider:anthropic ');
  assert.equal(
    removeUsageWorkspaceQueryToken('provider:anthropic tool:grep ', 'tool:grep'),
    'provider:anthropic ',
  );
  assert.equal(
    setUsageWorkspaceQueryTokensForKey('provider:anthropic tool:grep ', 'tool', ['grep', 'ls']),
    'provider:anthropic tool:grep tool:ls ',
  );
  assert.equal(
    applyUsageWorkspaceQuerySuggestion('provider:ant', 'provider:anthropic'),
    'provider:anthropic ',
  );
});

await runTest('usage workspace range selection supports toggle and shift-range semantics', () => {
  assert.deepEqual(applyShiftRangeSelection([], 'b', ['a', 'b', 'c'], false), ['b']);
  assert.deepEqual(applyShiftRangeSelection(['b'], 'd', ['a', 'b', 'c', 'd'], true), ['b', 'c', 'd']);
  assert.deepEqual(applyShiftRangeSelection(['b', 'c', 'd'], 'c', ['a', 'b', 'c', 'd'], false), ['b', 'd']);
});

await runTest('usage workspace log helpers parse tool summaries and filter logs by role, tool, and query', () => {
  const toolSummary = parseUsageWorkspaceLogTools(
    '[Tool: grep]\n[Tool: read_file]\n[Tool Result]\nFound 4 matches',
  );

  assert.deepEqual(toolSummary.tools, [
    ['grep', 1],
    ['read_file', 1],
  ]);
  assert.equal(toolSummary.cleanContent, 'Found 4 matches');

  const filtered = filterUsageWorkspaceLogs(
    [
      {
        timestamp: Date.UTC(2026, 3, 7, 10, 0, 0),
        role: 'assistant',
        content: '[Tool: grep]\nDeploy finished successfully',
        tokens: 42,
        cost: 0.11,
      },
      {
        timestamp: Date.UTC(2026, 3, 7, 10, 5, 0),
        role: 'user',
        content: 'Please check the rollout plan',
        tokens: 15,
        cost: 0,
      },
    ],
    {
      roles: ['assistant'],
      tools: ['grep'],
      hasTools: true,
      query: 'deploy',
    },
  );

  assert.equal(filtered.entries.length, 1);
  assert.equal(filtered.entries[0]?.cleanContent, 'Deploy finished successfully');
  assert.deepEqual(filtered.toolOptions, ['grep']);
});
