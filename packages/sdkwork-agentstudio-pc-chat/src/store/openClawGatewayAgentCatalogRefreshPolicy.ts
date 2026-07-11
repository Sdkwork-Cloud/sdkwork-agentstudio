import type { OpenClawGatewayAgentEvent } from '../services/store/index.ts';
import {
  parseOpenClawGatewayAgentLifecycleEvent,
} from '../services/index.ts';

const COMPLETED_TOOL_PHASES = new Set([
  'complete',
  'completed',
  'done',
  'final',
  'result',
  'success',
  'succeeded',
]);

const AGENT_CATALOG_MUTATION_NAMES = new Set([
  'agent.create',
  'agent.delete',
  'agent.import',
  'agent.install',
  'agent.remove',
  'agent.save',
  'agent.update',
  'agent.upsert',
  'agents.create',
  'agents.delete',
  'agents.import',
  'agents.install',
  'agents.remove',
  'agents.save',
  'agents.update',
  'agents.upsert',
  'create.agent',
  'create.agents',
  'delete.agent',
  'delete.agents',
  'import.agent',
  'import.agents',
  'install.agent',
  'install.agents',
  'remove.agent',
  'remove.agents',
  'save.agent',
  'save.agents',
  'update.agent',
  'update.agents',
  'upsert.agent',
  'upsert.agents',
]);

const AGENT_CATALOG_MUTATION_ACTIONS = new Set([
  'create',
  'created',
  'delete',
  'deleted',
  'import',
  'imported',
  'install',
  'installed',
  'remove',
  'removed',
  'save',
  'saved',
  'update',
  'updated',
  'upsert',
  'upserted',
]);

const TOOL_NAME_KEYS = ['name', 'tool', 'toolName', 'tool_name', 'method'];
const ACTION_KEYS = ['action', 'operation', 'op', 'type', 'event'];

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

function isCompletedToolPhase(data: Record<string, unknown> | null) {
  const phase = normalizeSignal(data?.phase);
  return !phase || COMPLETED_TOOL_PHASES.has(phase);
}

function isAgentMutationSignal(value: unknown) {
  const normalized = normalizeSignal(value);
  if (!normalized) {
    return false;
  }

  return AGENT_CATALOG_MUTATION_NAMES.has(normalized);
}

function isAgentMutationAction(value: unknown) {
  const normalized = normalizeSignal(value);
  if (!normalized) {
    return false;
  }

  return AGENT_CATALOG_MUTATION_ACTIONS.has(normalized);
}

function hasAgentMutationToolSignal(
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

  if (toolNames.some(isAgentMutationSignal) || actions.some(isAgentMutationSignal)) {
    return true;
  }

  for (const toolName of toolNames) {
    for (const action of actions) {
      if (
        isAgentMutationSignal(`${toolName}.${action}`) ||
        isAgentMutationSignal(`${action}.${toolName}`)
      ) {
        return true;
      }
    }
  }

  return false;
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

function hasLifecycleCatalogSignal(
  payload: Record<string, unknown>,
  data: Record<string, unknown> | null,
) {
  const stream = normalizeSignal(payload.stream);
  if (
    stream === 'agent.catalog' ||
    stream === 'agents.catalog' ||
    stream === 'catalog'
  ) {
    return true;
  }

  const actions = [
    ...collectStringValues(data, ACTION_KEYS),
    ...collectStringValues(payload, ACTION_KEYS),
  ];
  if (!actions.some(isAgentMutationAction)) {
    return false;
  }

  const subjects = [
    ...collectStringValues(data, ['subject', 'entity', 'resource', 'kind', 'scope']),
    ...collectStringValues(payload, ['subject', 'entity', 'resource', 'kind', 'scope']),
  ];

  return subjects.length === 0
    ? true
    : subjects.some((subject) => {
        const normalized = normalizeSignal(subject);
        return normalized === 'agent' || normalized === 'agents' || normalized.includes('agent');
      });
}

export function shouldRefreshChatAgentCatalogForGatewayAgentEvent(
  payload: OpenClawGatewayAgentEvent | Record<string, unknown> | null | undefined,
) {
  const payloadRecord = toRecord(payload);
  if (!payloadRecord) {
    return false;
  }

  const stream = normalizeSignal(payloadRecord.stream);
  const data = toRecord(payloadRecord.data);
  if (looksLikeToolEvent(stream, data)) {
    return (
      (isCompletedToolPhase(data) && hasAgentMutationToolSignal(payloadRecord, data)) ||
      Boolean(
        parseOpenClawGatewayAgentLifecycleEvent({
          instanceId: '__policy__',
          payload: payloadRecord,
        }),
      )
    );
  }

  return (
    hasLifecycleCatalogSignal(payloadRecord, data) ||
    Boolean(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: '__policy__',
        payload: payloadRecord,
      }),
    )
  );
}
