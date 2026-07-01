import assert from 'node:assert/strict';
import {
  AGENT_MARKET_TEMPLATES,
  buildAgentWorkspaceFiles,
  createAgentMarketCatalog,
} from './agentCatalog.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('createAgentMarketCatalog filters templates by category and keyword while keeping stable priority ordering', () => {
  const catalog = createAgentMarketCatalog({
    templates: AGENT_MARKET_TEMPLATES,
    keyword: 'incident',
    activeCategory: 'Operations',
  });

  assert.equal(catalog.categories.includes('All'), true);
  assert.equal(catalog.categories.includes('Operations'), true);
  assert.deepEqual(catalog.templates.map((template) => template.id), ['ops-responder']);
});

runTest('createAgentMarketCatalog can search localized metadata when a resolver is provided', () => {
  const catalog = createAgentMarketCatalog({
    templates: AGENT_MARKET_TEMPLATES,
    keyword: 'incidentes',
    activeCategory: 'All',
    searchValueResolver: (template) =>
      template.id === 'ops-responder'
        ? ['respuesta a incidentes', 'manual de operaciones']
        : [template.name],
  });

  assert.deepEqual(catalog.templates.map((template) => template.id), ['ops-responder']);
});

runTest('buildAgentWorkspaceFiles emits the OpenClaw bootstrap file set for marketplace-installed agents', () => {
  const template = AGENT_MARKET_TEMPLATES.find((entry) => entry.id === 'research-analyst');
  assert.ok(template);

  const files = buildAgentWorkspaceFiles(template);

  assert.deepEqual(Object.keys(files).sort(), [
    'AGENTS.md',
    'BOOT.md',
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'IDENTITY.md',
    'MEMORY.md',
    'SOUL.md',
    'TOOLS.md',
    'USER.md',
  ]);
  assert.match(files['IDENTITY.md'], /- Name: Research Analyst/);
  assert.match(files['IDENTITY.md'], /- Emoji: \u{1F50E}/u);
  assert.match(files['AGENTS.md'], /Research Analyst/);
  assert.match(files['SOUL.md'], /evidence/);
  assert.match(files['BOOT.md'], /startup actions/i);
  assert.match(files['BOOT.md'], /internal hooks are enabled/i);
  assert.match(files['BOOT.md'], /NO_REPLY/);
});

runTest('buildAgentWorkspaceFiles aligns the generated prompts with OpenClaw workspace conventions', () => {
  const template = AGENT_MARKET_TEMPLATES.find((entry) => entry.id === 'orchestrator');
  assert.ok(template);

  const files = buildAgentWorkspaceFiles(template);

  assert.match(files['AGENTS.md'], /Read `memory\/YYYY-MM-DD\.md`/);
  assert.match(files['AGENTS.md'], /today \+ yesterday/i);
  assert.match(files['AGENTS.md'], /If in the main private session/i);
  assert.match(files['AGENTS.md'], /Do not ask permission for this startup routine/i);
  assert.match(files['AGENTS.md'], /shared or group contexts/i);
  assert.match(files['AGENTS.md'], /If something matters, write it to a file/i);
  assert.match(files['HEARTBEAT.md'], /skip heartbeat/i);
  assert.doesNotMatch(files['HEARTBEAT.md'], /HEARTBEAT_OK/);
  assert.match(files['BOOTSTRAP.md'], /Who am I to you/i);
  assert.match(files['BOOTSTRAP.md'], /Delete this file once the first-run ritual is finished/i);
  assert.match(files['BOOT.md'], /comment-only to disable startup actions/i);
});

runTest('agent market templates keep stable display avatars without mojibake metadata', () => {
  assert.deepEqual(
    AGENT_MARKET_TEMPLATES.map((template) => [template.id, template.emoji]),
    [
      ['orchestrator', '\u{1F39B}\uFE0F'],
      ['coding-engineer', '\u{1F6E0}\uFE0F'],
      ['ops-responder', '\u{1F6A8}'],
      ['research-analyst', '\u{1F50E}'],
      ['content-writer', '\u270D\uFE0F'],
      ['support-triage', '\u{1F9ED}'],
    ],
  );
});
