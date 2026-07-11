import assert from 'node:assert/strict';
import {
  buildChatAgentCreateRequest,
  resolveKernelAgentCreationFieldSupport,
} from './chatAgentCreationCapability.ts';
import { createChatAgentDraft } from './chatAgentDraft.ts';

const HERMES_FIELD_SUPPORT = {
  avatar: true,
  isDefault: false,
  primaryModel: false,
  fallbackModels: false,
  workspace: false,
  agentDir: false,
  temperature: false,
  topP: false,
  maxTokens: false,
  timeoutMs: false,
  streaming: false,
} as const;

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'resolveKernelAgentCreationFieldSupport rejects kernel options that omit explicit field support declarations',
  () => {
    assert.throws(
      () =>
        resolveKernelAgentCreationFieldSupport({
          kernelId: 'openclaw',
          label: 'OpenClaw',
          supported: true,
          reasonCode: null,
          reason: null,
          modelOptions: [],
        } as any),
      /field support/i,
    );
  },
);

await runTest(
  'resolveKernelAgentCreationFieldSupport resolves explicitly declared kernel field support without fallback defaults',
  () => {
    assert.deepEqual(
      resolveKernelAgentCreationFieldSupport({
        kernelId: 'openclaw',
        label: 'OpenClaw',
        supported: true,
        reasonCode: null,
        reason: null,
        modelOptions: [],
        fieldSupport: {
          avatar: true,
          isDefault: true,
          primaryModel: true,
          fallbackModels: true,
          workspace: true,
          agentDir: true,
          temperature: true,
          topP: true,
          maxTokens: true,
          timeoutMs: true,
          streaming: true,
        },
      }),
      {
        avatar: true,
        isDefault: true,
        primaryModel: true,
        fallbackModels: true,
        workspace: true,
        agentDir: true,
        temperature: true,
        topP: true,
        maxTokens: true,
        timeoutMs: true,
        streaming: true,
      },
    );
  },
);

await runTest(
  'buildChatAgentCreateRequest strips unsupported Hermes-only fields from the submission payload',
  () => {
    const draft = createChatAgentDraft();
    draft.agentId = 'research-planner';
    draft.displayName = 'Research Planner';
    draft.avatar = 'RP';
    draft.primaryModel = 'hermes/research';
    draft.fallbackModelsText = 'hermes/support';
    draft.workspace = 'workspace/research';
    draft.agentDir = 'agents/research';
    draft.temperature = '0.1';
    draft.topP = '0.9';
    draft.maxTokens = '4096';
    draft.timeoutMs = '45000';
    draft.isDefault = true;
    draft.streamingMode = 'enabled';

    const request = buildChatAgentCreateRequest({
      instanceId: 'instance-hermes',
      kernelId: 'hermes',
      draft,
      fieldSupport: resolveKernelAgentCreationFieldSupport({
        kernelId: 'hermes',
        label: 'Hermes',
        supported: true,
        reasonCode: null,
        reason: null,
        modelOptions: [],
        fieldSupport: HERMES_FIELD_SUPPORT,
      }),
      temperature: 0.1,
      topP: 0.9,
      maxTokens: 4096,
      timeoutMs: 45_000,
    });

    assert.deepEqual(request, {
      instanceId: 'instance-hermes',
      kernelId: 'hermes',
      agentId: 'research-planner',
      displayName: 'Research Planner',
      avatar: 'RP',
      isDefault: false,
      primaryModel: null,
      fallbackModels: [],
      workspace: null,
      agentDir: null,
      temperature: null,
      topP: null,
      maxTokens: null,
      timeoutMs: null,
      streaming: null,
    });
  },
);

await runTest(
  'buildChatAgentCreateRequest normalizes fallback models so the primary model is never duplicated as a fallback',
  () => {
    const draft = createChatAgentDraft();
    draft.agentId = 'coding-engineer';
    draft.displayName = 'Coding Engineer';
    draft.primaryModel = 'openai/gpt-5.1';
    draft.fallbackModelsText = [
      'openai/gpt-5.1',
      'anthropic/claude-sonnet-4',
      'openai/gpt-5.1',
    ].join('\n');

    const request = buildChatAgentCreateRequest({
      instanceId: 'instance-openclaw',
      kernelId: 'openclaw',
      draft,
      fieldSupport: resolveKernelAgentCreationFieldSupport({
        kernelId: 'openclaw',
        label: 'OpenClaw',
        supported: true,
        reasonCode: null,
        reason: null,
        modelOptions: [],
        fieldSupport: {
          avatar: true,
          isDefault: true,
          primaryModel: true,
          fallbackModels: true,
          workspace: true,
          agentDir: true,
          temperature: true,
          topP: true,
          maxTokens: true,
          timeoutMs: true,
          streaming: true,
        },
      }),
      temperature: null,
      topP: null,
      maxTokens: null,
      timeoutMs: null,
    });

    assert.deepEqual(request.fallbackModels, ['anthropic/claude-sonnet-4']);
  },
);
