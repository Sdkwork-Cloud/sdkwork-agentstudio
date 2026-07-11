import { studio } from '@sdkwork/agentstudio-pc-infrastructure';
import { providerRoutingCatalogService } from '../services/index.ts';
import { instanceStore } from '../stores/instanceStore.ts';

export interface AIRequestOptions {
  prompt: string;
  context?: string;
  systemInstruction?: string;
  onChunk?: (text: string) => void;
}

export interface ILLMService {
  generateContent(options: AIRequestOptions): Promise<string>;
  generateContentStream(options: AIRequestOptions): Promise<string>;
}

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are an expert AI assistant helping a user write and edit content. Provide helpful, accurate, and concise responses.';

const OPENCLAW_CHAT_ENDPOINT_SUFFIXES = [
  '/v1/chat/completions',
  '/chat/completions',
  '/v1/responses',
  '/responses',
] as const;
const STANDARD_CHAT_ENDPOINT_SUFFIXES = [
  '/v1/chat/completions',
  '/chat/completions',
] as const;
const WEB_CHAT_ENDPOINT_SUFFIXES = ['/api/chat/completions'] as const;
const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 60_000;

type ActiveInstanceRecord = NonNullable<Awaited<ReturnType<typeof studio.getInstance>>>;
type ProviderRoutingRecord = Awaited<
  ReturnType<typeof providerRoutingCatalogService.listProviderRoutingRecords>
>[number];

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function extractTextFragments(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return payload ? [payload] : [];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractTextFragments(entry));
  }

  const record = payload as Record<string, unknown>;

  if (record.choices) {
    return extractTextFragments(record.choices);
  }

  if (record.delta) {
    return extractTextFragments(record.delta);
  }

  if (record.message) {
    return extractTextFragments(record.message);
  }

  if (record.data) {
    return extractTextFragments(record.data);
  }

  if (Array.isArray(record.content)) {
    return record.content.flatMap((entry) => extractTextFragments(entry));
  }

  if (typeof record.content === 'string') {
    return record.content ? [record.content] : [];
  }

  if (typeof record.text === 'string') {
    return record.text ? [record.text] : [];
  }

  return [];
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
    const fragments = extractTextFragments(payload);
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
      for (const payloadText of extractFramePayloads(frame)) {
        if (!payloadText || payloadText === '[DONE]') {
          if (payloadText === '[DONE]') {
            return;
          }
          continue;
        }

        try {
          const fragments = extractTextFragments(JSON.parse(payloadText));
          if (fragments.length > 0) {
            for (const fragment of fragments) {
              yield fragment;
            }
            continue;
          }
        } catch {
          // Fall back to yielding raw text when the stream frame is not JSON.
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

    try {
      const fragments = extractTextFragments(JSON.parse(payloadText));
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          yield fragment;
        }
        continue;
      }
    } catch {
      // Keep the trailing raw text when it is not JSON.
    }

    yield payloadText;
  }
}

function buildPrompt(options: AIRequestOptions) {
  if (!options.context) {
    return options.prompt;
  }

  return `Context:\n"""\n${options.context}\n"""\n\nUser Request: ${options.prompt}`;
}

function buildInstanceHeaders(instance: ActiveInstanceRecord) {
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

function appendSuffix(baseUrl: string, suffix: string) {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  return normalizedBaseUrl ? `${normalizedBaseUrl}${suffix}` : null;
}

function appendSuffixes(baseUrl: string, suffixes: readonly string[]) {
  return Array.from(
    new Set(
      suffixes
        .map((suffix) => appendSuffix(baseUrl, suffix))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function listEndpointCandidates(instance: ActiveInstanceRecord): string[] {
  const baseUrl = normalizeUrl(instance.baseUrl ?? instance.config?.baseUrl ?? null);
  if (!baseUrl) {
    return [];
  }

  if (OPENCLAW_CHAT_ENDPOINT_SUFFIXES.some((suffix) => baseUrl.endsWith(suffix))) {
    return [baseUrl];
  }

  switch (instance.transportKind) {
    case 'zeroclawHttp':
    case 'openaiHttp':
    case 'customHttp':
      return appendSuffixes(baseUrl, STANDARD_CHAT_ENDPOINT_SUFFIXES);
    case 'ironclawWeb':
      return appendSuffixes(baseUrl, WEB_CHAT_ENDPOINT_SUFFIXES);
    case 'openclawGatewayWs':
      return appendSuffixes(baseUrl, STANDARD_CHAT_ENDPOINT_SUFFIXES);
    default:
      return appendSuffixes(baseUrl, STANDARD_CHAT_ENDPOINT_SUFFIXES);
  }
}

function createMissingInstanceError() {
  return new Error('Select or start an AI-compatible instance before using AI generation.');
}

function createMissingEndpointError(instance: ActiveInstanceRecord) {
  return new Error(
    `${instance.name} does not expose a compatible HTTP generation endpoint yet.`,
  );
}

async function listEnabledProviderRoutingRecords(): Promise<ProviderRoutingRecord[]> {
  return (await providerRoutingCatalogService.listProviderRoutingRecords().catch(() => []))
    .filter((record) => record.enabled);
}

function normalizeRequestTimeoutMs(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LLM_REQUEST_TIMEOUT_MS;
}

function resolveRequestTimeoutMs(records: ProviderRoutingRecord[]) {
  const preferredRecord = records.find((record) => record.isDefault) ?? records[0] ?? null;
  return normalizeRequestTimeoutMs(preferredRecord?.config?.timeoutMs);
}

function createRequestTimeoutError(endpoint: string, timeoutMs: number) {
  return new Error(`AI generation request to ${endpoint} timed out after ${timeoutMs}ms.`);
}

async function fetchWithTimeout(
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
) {
  if (typeof AbortController === 'undefined') {
    return fetch(endpoint, init);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort(createRequestTimeoutError(endpoint, timeoutMs));
  }, timeoutMs);

  try {
    return await fetch(endpoint, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      throw reason instanceof Error
        ? reason
        : createRequestTimeoutError(endpoint, timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

class LLMService implements ILLMService {
  private async resolveRequestConfig() {
    const records = await listEnabledProviderRoutingRecords();
    const modelIds = Array.from(
      new Set(
        records
          .flatMap((record) => [
            record.defaultModelId,
            record.reasoningModelId,
            record.embeddingModelId,
            ...record.models.map((model) => model.id),
          ])
          .map((modelId) => modelId?.trim())
          .filter((modelId): modelId is string => Boolean(modelId)),
      ),
    );

    return {
      modelId: modelIds[0] || 'openclaw/default',
      timeoutMs: resolveRequestTimeoutMs(records),
    };
  }

  private async resolveActiveInstanceTarget() {
    const { activeInstanceId } = instanceStore.getState();
    if (!activeInstanceId) {
      throw createMissingInstanceError();
    }

    const activeInstance = await studio.getInstance(activeInstanceId);
    if (!activeInstance) {
      throw createMissingInstanceError();
    }

    const endpointCandidates = listEndpointCandidates(activeInstance);
    if (endpointCandidates.length === 0) {
      throw createMissingEndpointError(activeInstance);
    }

    return {
      activeInstance,
      endpointCandidates,
    };
  }

  private async executePrompt(options: AIRequestOptions) {
    const { activeInstance, endpointCandidates } = await this.resolveActiveInstanceTarget();
    const requestConfig = await this.resolveRequestConfig();
    const prompt = buildPrompt(options);
    const headers = buildInstanceHeaders(activeInstance);
    const body = JSON.stringify({
      model: requestConfig.modelId,
      messages: [
        {
          role: 'system',
          content: options.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
      metadata: {
        instanceId: activeInstance.id,
        runtimeKind: activeInstance.runtimeKind,
        deploymentMode: activeInstance.deploymentMode,
        transportKind: activeInstance.transportKind,
      },
    });

    let lastError: Error | null = null;

    for (const endpoint of endpointCandidates) {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers,
          body,
        },
        requestConfig.timeoutMs,
      ).catch((error: unknown) => {
        lastError = error instanceof Error ? error : new Error(String(error));
        return null;
      });

      if (!response) {
        continue;
      }

      if (!response.ok) {
        if (
          (response.status === 404 || response.status === 405) &&
          endpoint !== endpointCandidates[endpointCandidates.length - 1]
        ) {
          continue;
        }

        if (response.status === 404 || response.status === 405) {
          throw createMissingEndpointError(activeInstance);
        }

        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      let fullText = '';
      for await (const chunk of streamHttpResponse(response)) {
        fullText += chunk;
        options.onChunk?.(chunk);
      }
      return fullText;
    }

    throw lastError ?? createMissingEndpointError(activeInstance);
  }

  async generateContent(options: AIRequestOptions): Promise<string> {
    return this.executePrompt(options);
  }

  async generateContentStream(options: AIRequestOptions): Promise<string> {
    return this.executePrompt(options);
  }
}

export const llmService = new LLMService();
