import { llmStore } from '@sdkwork/clawstudio-core';
import { instanceStore } from '@sdkwork/clawstudio-core';
import type { Agent, Skill, StudioInstanceRecord } from '@sdkwork/clawstudio-types';
import type { StudioConversationAttachment } from '@sdkwork/clawstudio-types';
import type { KernelChatAdapterResolution } from './kernelChatAdapterRegistry.ts';
import type { InstanceChatRoute } from './instanceChatRouteService.ts';
import { resolveAuthoritativeInstanceKernelChatAdapter } from './authoritativeKernelChatAdapter.ts';
import { buildChatHttpRequestMessages } from './chatHttpMessagePayload.ts';
import {
  extractChatHttpPayloadTextFragments,
  extractChatHttpStreamTextDeltas,
  isLikelyChatHttpProtocolFrame,
} from './chatHttpStreamProtocol.ts';
import { resolveKernelOwnedSessionId } from './chatSessionBinding.ts';
import { resolveGatewayAuthoritativeKernelChat } from './kernelChatAuthorityPolicy.ts';
import { resolveAuthoritativeInstanceChatRoute } from './store/index.ts';
import type { ChatModel } from '../types/index.ts';

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Claw Studio AI assistant. You help users manage devices, write automation scripts, and answer questions about the ClawHub ecosystem. Keep your answers concise and helpful.';

const DEFAULT_LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
};

export interface IChatService {
  createChatSession(modelId: string, skill?: Skill, agent?: Agent): any;
  sendMessageStream(
    chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
    attachments?: StudioConversationAttachment[],
  ): AsyncGenerator<string, void, unknown>;
}

export interface ActiveInstanceChatContext {
  activeInstance: StudioInstanceRecord | null;
  route: InstanceChatRoute;
  adapterResolution: KernelChatAdapterResolution | null;
}

export type ChatServiceStreamRequest = (
  endpoint: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  abortSignal?: AbortSignal,
) => AsyncGenerator<string, void, unknown>;

export interface ChatServiceDependencies {
  getActiveInstanceId: () => string | null;
  getInstanceConfig: ReturnType<typeof llmStore.getState>['getInstanceConfig'];
  resolveActiveInstanceContext: () => Promise<ActiveInstanceChatContext>;
  streamRequest: ChatServiceStreamRequest;
}

export interface ChatServiceDependencyOverrides {
  getActiveInstanceId?: ChatServiceDependencies['getActiveInstanceId'];
  getInstanceConfig?: ChatServiceDependencies['getInstanceConfig'];
  resolveActiveInstanceContext?: ChatServiceDependencies['resolveActiveInstanceContext'];
  streamRequest?: ChatServiceDependencies['streamRequest'];
}

export function buildSystemInstruction(skill?: Skill, agent?: Agent) {
  let systemInstruction = agent?.systemPrompt ?? DEFAULT_SYSTEM_INSTRUCTION;

  if (skill) {
    systemInstruction += `\n\nYou are currently equipped with the "${skill.name}" skill.\nSkill Description: ${skill.description}\nSkill Category: ${skill.category}\n\nUse this skill context when it is relevant. Do not claim an action was executed unless the live runtime or an actual tool invocation completed it.`;
  }

  return systemInstruction;
}

export function buildContextualMessage(message: string, skill?: Skill, agent?: Agent) {
  let contextPrefix = '';

  if (agent) {
    contextPrefix += `[Role: ${agent.systemPrompt}]\n`;
  }

  if (skill) {
    contextPrefix += `[Context: You are equipped with the "${skill.name}" skill. Description: ${skill.description}]\n`;
  }

  return contextPrefix ? `${contextPrefix}\nUser: ${message}` : message;
}

function extractFramePayloads(frame: string) {
  const lines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  return dataLines.length > 0 ? dataLines : lines;
}

async function* streamHttpResponse(response: Response): AsyncGenerator<string, void, unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    const fragments = extractChatHttpPayloadTextFragments(payload);
    if (fragments.length > 0) {
      for (const fragment of fragments) {
        yield fragment;
      }
      return;
    }

    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (text) {
      yield text;
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const fragments = extractChatHttpStreamTextDeltas(frame);
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          yield fragment;
        }
        continue;
      }

      for (const payloadText of extractFramePayloads(frame)) {
        if (!payloadText || payloadText === '[DONE]') {
          if (payloadText === '[DONE]') {
            return;
          }
          continue;
        }

        if (payloadText.startsWith('event:') || payloadText.startsWith('data:')) {
          continue;
        }

        yield payloadText;
      }
    }

    if (done) {
      break;
    }
  }

  const trailing = buffer.trim();
  if (!trailing) {
    return;
  }

  for (const payloadText of extractFramePayloads(trailing)) {
    if (!payloadText || payloadText === '[DONE]') {
      continue;
    }

    const fragments = extractChatHttpStreamTextDeltas(payloadText);
    if (fragments.length > 0) {
      for (const fragment of fragments) {
        yield fragment;
      }
      continue;
    }

    yield payloadText;
  }
}

async function* streamOpenAiCompatibleRequest(
  endpoint: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  abortSignal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal: abortSignal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  yield* streamHttpResponse(response);
}

function buildInstanceHeaders(instance: StudioInstanceRecord) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  };
  const authToken = instance.config.authToken;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

function resolveHermesSessionId(chatSession: any): string | null {
  return resolveKernelOwnedSessionId(chatSession);
}

function shouldForwardHermesSessionId(context: {
  activeInstance: StudioInstanceRecord;
  chatSession: any;
}) {
  if (context.activeInstance.runtimeKind !== 'hermes') {
    return false;
  }

  return Boolean(resolveHermesSessionId(context.chatSession));
}

async function resolveDefaultActiveInstanceContext(): Promise<ActiveInstanceChatContext> {
  const { activeInstanceId } = instanceStore.getState();
  if (!activeInstanceId) {
    return {
      activeInstance: null,
      route: (await resolveAuthoritativeInstanceChatRoute(null)).route,
      adapterResolution: null,
    };
  }

  const { instance, route } = await resolveAuthoritativeInstanceChatRoute(activeInstanceId);
  return {
    activeInstance: instance,
    route,
    adapterResolution: instance
      ? await resolveAuthoritativeInstanceKernelChatAdapter(activeInstanceId)
      : null,
  };
}

function resolveNotReadyReason(context: ActiveInstanceChatContext) {
  return (
    context.route.reason ||
    context.adapterResolution?.capabilities.reason ||
    'This runtime is not chat-ready yet.'
  );
}

async function* normalizeChatTransportStream(
  source: AsyncGenerator<string, void, unknown>,
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of source) {
    if (!isLikelyChatHttpProtocolFrame(chunk)) {
      yield chunk;
      continue;
    }

    const deltas = extractChatHttpStreamTextDeltas(chunk);
    for (const delta of deltas) {
      yield delta;
    }
  }
}

class ChatService implements IChatService {
  private readonly dependencies: ChatServiceDependencies;

  constructor(dependencies: ChatServiceDependencies) {
    this.dependencies = dependencies;
  }

  createChatSession(_modelId: string, _skill?: Skill, _agent?: Agent) {
    return null;
  }

  async *sendMessageStream(
    chatSession: any,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
    attachments: StudioConversationAttachment[] = [],
  ): AsyncGenerator<string, void, unknown> {
    const activeInstanceId = this.dependencies.getActiveInstanceId();
    const instanceConfig = activeInstanceId
      ? this.dependencies.getInstanceConfig(activeInstanceId)
      : null;
    const config = instanceConfig?.config ?? DEFAULT_LLM_CONFIG;
    const finalMessage = buildContextualMessage(message, skill, agent);
    const context = await this.dependencies.resolveActiveInstanceContext();
    const { activeInstance, route, adapterResolution } = context;

    if (!activeInstance) {
      yield 'Error: Select or start an AI-compatible instance to chat.';
      return;
    }

    if (adapterResolution?.capabilities.supported === false) {
      yield `\n\n**${activeInstance.name}** is not chat-ready yet: ${resolveNotReadyReason(context)}`;
      return;
    }

    if (route.mode === 'unsupported') {
      yield `\n\n**${activeInstance.name}** is not chat-ready yet: ${resolveNotReadyReason(context)}`;
      return;
    }

    if (
      resolveGatewayAuthoritativeKernelChat({
        adapterCapabilities: adapterResolution?.capabilities ?? null,
      })
    ) {
      yield `\n\n**${activeInstance.name}** uses the native gateway WebSocket flow. Claw Studio now drives that route through the chat session store instead of the generic HTTP stream service.`;
      return;
    }

    if (route.endpoint) {
      try {
        const headers = buildInstanceHeaders(activeInstance);
        if (shouldForwardHermesSessionId({ activeInstance, chatSession })) {
          headers['X-Hermes-Session-Id'] = resolveHermesSessionId(chatSession)!;
        }

        const stream = this.dependencies.streamRequest(
          route.endpoint,
          {
            model: model.id,
            messages: buildChatHttpRequestMessages({
              systemInstruction: buildSystemInstruction(skill, agent),
              userText: finalMessage,
              attachments,
            }),
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            stream: true,
            metadata: {
              instanceId: activeInstance.id,
              runtimeKind: activeInstance.runtimeKind,
              deploymentMode: activeInstance.deploymentMode,
              transportKind: activeInstance.transportKind,
            },
          },
          headers,
          abortSignal,
        );
        yield* normalizeChatTransportStream(stream);
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw error;
        }

        yield `\n\n**Error connecting to ${activeInstance.name}:** ${error.message}`;
        return;
      }
    }

    if (route.mode === 'instanceWebSocket') {
      yield `\n\n**${activeInstance.name}** currently only publishes a WebSocket chat route (${route.websocketUrl}). Configure an HTTP endpoint to enable Claw Studio chat streaming.`;
      return;
    }

    yield `\n\n**${activeInstance.name}** does not currently expose a compatible streaming chat endpoint.`;
  }
}

export function createChatService(
  overrides: ChatServiceDependencyOverrides = {},
) {
  return new ChatService({
    getActiveInstanceId:
      overrides.getActiveInstanceId || (() => instanceStore.getState().activeInstanceId),
    getInstanceConfig:
      overrides.getInstanceConfig ||
      ((instanceId) => llmStore.getState().getInstanceConfig(instanceId)),
    resolveActiveInstanceContext:
      overrides.resolveActiveInstanceContext || resolveDefaultActiveInstanceContext,
    streamRequest: overrides.streamRequest || streamOpenAiCompatibleRequest,
  });
}

export const chatService = createChatService();
