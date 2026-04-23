import assert from 'node:assert/strict';
import {
  createChatAgentDraft,
  createChatAgentDraftFromLibraryAgent,
} from './chatAgentDraft.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('createChatAgentDraft returns the canonical empty custom-create draft', () => {
  assert.deepEqual(createChatAgentDraft(), {
    agentId: '',
    displayName: '',
    avatar: '',
    primaryModel: '',
    fallbackModelsText: '',
    workspace: '',
    agentDir: '',
    temperature: '',
    topP: '',
    maxTokens: '',
    timeoutMs: '',
    isDefault: false,
    streamingMode: 'inherit',
  });
});

await runTest(
  'createChatAgentDraftFromLibraryAgent copies only portable local-kernel settings and leaves target paths derived by the destination instance',
  () => {
    const draft = createChatAgentDraftFromLibraryAgent({
      sourceInstanceId: 'external',
      sourceInstanceName: 'External OpenClaw',
      sourceKernelId: 'openclaw',
      sourceInstanceHost: 'localhost',
      sourceInstanceBuiltIn: false,
      sourceInstanceStatus: 'ready',
      sourceConfigFile: 'D:/External/.openclaw/openclaw.json',
      agentId: 'ops-responder',
      displayName: 'Ops Responder',
      avatar: 'OR',
      description: 'Incident response specialist.',
      isDefault: false,
      workspace: 'D:/External/workspace',
      agentDir: 'D:/External/.openclaw/agents/ops-responder/agent',
      model: {
        primary: 'openai/gpt-5.1-mini',
        fallbacks: ['anthropic/claude-sonnet-4'],
      },
      params: {
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 12000,
        timeoutMs: 45000,
        streaming: false,
      },
    });

    assert.deepEqual(draft, {
      agentId: 'ops-responder-copy',
      displayName: 'Ops Responder Copy',
      avatar: 'OR',
      primaryModel: 'openai/gpt-5.1-mini',
      fallbackModelsText: 'anthropic/claude-sonnet-4',
      workspace: '',
      agentDir: '',
      temperature: '0.2',
      topP: '0.9',
      maxTokens: '12000',
      timeoutMs: '45000',
      isDefault: false,
      streamingMode: 'disabled',
    });
  },
);
