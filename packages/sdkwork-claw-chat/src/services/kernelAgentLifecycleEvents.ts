import type { OpenClawGatewayAgentEvent } from './openclaw/gatewayProtocol.ts';

export type KernelAgentLifecycleEventType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'catalogChanged';

export type KernelAgentLifecycleEventSource =
  | 'openclawGateway'
  | 'kernelAdapter'
  | 'platform';

export interface KernelAgentLifecycleEvent {
  instanceId: string;
  kernelId: string;
  type: KernelAgentLifecycleEventType;
  agentId: string | null;
  source: KernelAgentLifecycleEventSource;
  payload: OpenClawGatewayAgentEvent | Record<string, unknown>;
}

const COMPLETED_TOOL_PHASES = new Set([
  'complete',
  'completed',
  'done',
  'final',
  'result',
  'success',
  'succeeded',
]);

const TOOL_NAME_KEYS = ['name', 'tool', 'toolName', 'tool_name', 'method'];
const ACTION_KEYS = ['action', 'operation', 'op', 'type', 'event'];
const SUBJECT_KEYS = ['subject', 'entity', 'resource', 'kind', 'scope'];
const AGENT_ID_KEYS = ['agentId', 'agent_id', 'agentID', 'id'];
const METHOD_KEYS = ['method', 'rpcMethod', 'rpc_method'];

const CREATE_SIGNALS = new Set([
  'agent.create',
  'agent.created',
  'agents.create',
  'agents.created',
  'create.agent',
  'create.agents',
  'created.agent',
  'created.agents',
]);

const UPDATE_SIGNALS = new Set([
  'agent.import',
  'agent.imported',
  'agent.install',
  'agent.installed',
  'agent.save',
  'agent.saved',
  'agent.update',
  'agent.updated',
  'agent.upsert',
  'agent.upserted',
  'agents.import',
  'agents.imported',
  'agents.install',
  'agents.installed',
  'agents.save',
  'agents.saved',
  'agents.update',
  'agents.updated',
  'agents.upsert',
  'agents.upserted',
  'import.agent',
  'import.agents',
  'install.agent',
  'install.agents',
  'save.agent',
  'save.agents',
  'update.agent',
  'update.agents',
  'upsert.agent',
  'upsert.agents',
]);

const DELETE_SIGNALS = new Set([
  'agent.delete',
  'agent.deleted',
  'agent.remove',
  'agent.removed',
  'agents.delete',
  'agents.deleted',
  'agents.remove',
  'agents.removed',
  'delete.agent',
  'delete.agents',
  'deleted.agent',
  'deleted.agents',
  'remove.agent',
  'remove.agents',
]);

const CREATE_ACTIONS = new Set(['create', 'created']);
const UPDATE_ACTIONS = new Set([
  'import',
  'imported',
  'install',
  'installed',
  'save',
  'saved',
  'update',
  'updated',
  'upsert',
  'upserted',
]);
const DELETE_ACTIONS = new Set(['delete', 'deleted', 'remove', 'removed']);
const CONFIG_MUTATION_METHODS = new Set([
  'config.apply',
  'config.patch',
  'config.set',
  'gateway.config.apply',
  'gateway.config.patch',
  'gateway.config.set',
]);
const CONFIG_MUTATION_ACTIONS = new Set(['apply', 'patch', 'set']);

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeSignal(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_:/-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function collectStringValues(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  if (!record) {
    return [];
  }

  return keys
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function collectStringValuesDeep(
  value: unknown,
  keys: string[],
  depth = 0,
): string[] {
  if (depth > 5) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringValuesDeep(entry, keys, depth + 1));
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  return [
    ...collectStringValues(record, keys),
    ...Object.values(record).flatMap((entry) =>
      collectStringValuesDeep(entry, keys, depth + 1),
    ),
  ];
}

function isCompletedToolPhase(data: Record<string, unknown> | null) {
  const phase = normalizeSignal(data?.phase);
  return !phase || COMPLETED_TOOL_PHASES.has(phase);
}

function looksLikeToolEvent(
  stream: string,
  data: Record<string, unknown> | null,
) {
  if (stream === 'tool') {
    return true;
  }

  return Boolean(
    !stream &&
      data &&
      ('toolCallId' in data ||
        'tool_call_id' in data ||
        'phase' in data ||
        'partialResult' in data ||
        'result' in data ||
        'args' in data),
  );
}

function collectLifecycleSignals(
  payload: Record<string, unknown>,
  data: Record<string, unknown> | null,
) {
  const toolNames = [
    ...collectStringValues(data, TOOL_NAME_KEYS),
    ...collectStringValues(payload, TOOL_NAME_KEYS),
  ];
  const actions = [
    ...collectStringValues(data, ACTION_KEYS),
    ...collectStringValues(payload, ACTION_KEYS),
  ];
  const methods = [
    ...collectStringValuesDeep(data?.args, METHOD_KEYS),
    ...collectStringValuesDeep(data?.result, METHOD_KEYS),
    ...collectStringValuesDeep(payload, METHOD_KEYS),
  ];
  const signals = [
    ...toolNames,
    ...actions,
    ...methods,
  ].map(normalizeSignal).filter(Boolean);

  for (const toolName of toolNames) {
    for (const action of actions) {
      signals.push(normalizeSignal(`${toolName}.${action}`));
      signals.push(normalizeSignal(`${action}.${toolName}`));
    }
  }

  return signals.filter(Boolean);
}

function resolveLifecycleTypeFromSignals(
  signals: string[],
  options: {
    allowBareActions?: boolean;
  } = {},
): KernelAgentLifecycleEventType | null {
  if (
    signals.some(
      (signal) =>
        CREATE_SIGNALS.has(signal) ||
        (options.allowBareActions === true && CREATE_ACTIONS.has(signal)),
    )
  ) {
    return 'created';
  }

  if (
    signals.some(
      (signal) =>
        DELETE_SIGNALS.has(signal) ||
        (options.allowBareActions === true && DELETE_ACTIONS.has(signal)),
    )
  ) {
    return 'deleted';
  }

  if (
    signals.some(
      (signal) =>
        UPDATE_SIGNALS.has(signal) ||
        (options.allowBareActions === true && UPDATE_ACTIONS.has(signal)),
    )
  ) {
    return 'updated';
  }

  return null;
}

function hasAgentSubject(
  payload: Record<string, unknown>,
  data: Record<string, unknown> | null,
) {
  const subjects = [
    ...collectStringValues(data, SUBJECT_KEYS),
    ...collectStringValues(payload, SUBJECT_KEYS),
  ];
  if (subjects.length === 0) {
    return false;
  }

  return subjects.some((subject) => {
    const normalized = normalizeSignal(subject);
    return normalized === 'agent' || normalized === 'agents' || normalized.includes('agent');
  });
}

function isOpenClawAgentCatalogStream(stream: string) {
  return stream === 'agent.catalog' || stream === 'agents.catalog' || stream === 'catalog';
}

function isConfigMutationSignal(signals: string[]) {
  if (signals.some((signal) => CONFIG_MUTATION_METHODS.has(signal))) {
    return true;
  }

  const hasConfigTool = signals.includes('config') || signals.includes('gateway');
  return hasConfigTool && signals.some((signal) => CONFIG_MUTATION_ACTIONS.has(signal));
}

function containsAgentsCatalogPayload(value: unknown, depth = 0): boolean {
  if (depth > 6 || value == null) {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = normalizeSignal(value);
    return (
      normalized.includes('agents.list') ||
      normalized.includes('agents') ||
      normalized.includes('agentdir')
    );
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsAgentsCatalogPayload(entry, depth + 1));
  }

  const record = toRecord(value);
  if (!record) {
    return false;
  }

  for (const [key, entry] of Object.entries(record)) {
    const normalizedKey = normalizeSignal(key);
    if (
      normalizedKey === 'agents' ||
      normalizedKey === 'agents.list' ||
      normalizedKey === 'agentdir'
    ) {
      return true;
    }
    if (containsAgentsCatalogPayload(entry, depth + 1)) {
      return true;
    }
  }

  return false;
}

function findAgentId(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findAgentId(entry, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = toRecord(value);
  if (!record) {
    return null;
  }

  for (const key of AGENT_ID_KEYS) {
    const current = record[key];
    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }

  const preferredKeys = ['agent', 'data', 'result', 'args', 'params', 'raw', 'agents', 'list'];
  for (const key of preferredKeys) {
    const found = findAgentId(record[key], depth + 1);
    if (found) {
      return found;
    }
  }

  for (const entry of Object.values(record)) {
    const found = findAgentId(entry, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

function buildLifecycleEvent(input: {
  instanceId: string;
  kernelId: string;
  payload: Record<string, unknown>;
  type: KernelAgentLifecycleEventType;
  agentId: string | null;
}): KernelAgentLifecycleEvent {
  return {
    instanceId: input.instanceId,
    kernelId: input.kernelId,
    type: input.type,
    agentId: input.agentId,
    source: 'openclawGateway',
    payload: input.payload,
  };
}

export function parseOpenClawGatewayAgentLifecycleEvent(input: {
  instanceId: string;
  kernelId?: string;
  payload: OpenClawGatewayAgentEvent | Record<string, unknown> | null | undefined;
}): KernelAgentLifecycleEvent | null {
  const payload = toRecord(input.payload);
  if (!payload) {
    return null;
  }

  const kernelId = input.kernelId?.trim() || 'openclaw';
  const stream = normalizeSignal(payload.stream);
  const data = toRecord(payload.data);
  const signals = collectLifecycleSignals(payload, data);

  if (looksLikeToolEvent(stream, data)) {
    if (!isCompletedToolPhase(data)) {
      return null;
    }

    const toolLifecycleType = resolveLifecycleTypeFromSignals(signals);
    if (toolLifecycleType) {
      return buildLifecycleEvent({
        instanceId: input.instanceId,
        kernelId,
        payload,
        type: toolLifecycleType,
        agentId: findAgentId(data?.result) || findAgentId(data) || findAgentId(payload),
      });
    }

    if (
      isConfigMutationSignal(signals) &&
      containsAgentsCatalogPayload(data?.args ?? data?.result ?? payload)
    ) {
      return buildLifecycleEvent({
        instanceId: input.instanceId,
        kernelId,
        payload,
        type: 'catalogChanged',
        agentId: findAgentId(data?.args) || findAgentId(data?.result) || findAgentId(payload),
      });
    }

    return null;
  }

  if (isOpenClawAgentCatalogStream(stream)) {
    return buildLifecycleEvent({
      instanceId: input.instanceId,
      kernelId,
      payload,
      type:
        resolveLifecycleTypeFromSignals(signals, { allowBareActions: true }) ??
        'catalogChanged',
      agentId: findAgentId(payload),
    });
  }

  if (hasAgentSubject(payload, data)) {
    const lifecycleType = resolveLifecycleTypeFromSignals(signals, {
      allowBareActions: true,
    });
    if (lifecycleType) {
      return buildLifecycleEvent({
        instanceId: input.instanceId,
        kernelId,
        payload,
        type: lifecycleType,
        agentId: findAgentId(payload),
      });
    }
  }

  return null;
}
