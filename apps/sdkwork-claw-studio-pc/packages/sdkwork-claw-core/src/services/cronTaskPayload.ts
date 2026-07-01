import type { TaskCreateInput, TaskExecutionContent, TaskIntervalUnit } from './taskSchedule.ts';

export type CronTaskCreateInput = TaskCreateInput;
export type OpenClawCronTaskPayload = Record<string, unknown>;

function toEveryMs(value: number, unit: TaskIntervalUnit) {
  switch (unit) {
    case 'minute':
      return value * 60 * 1000;
    case 'hour':
      return value * 60 * 60 * 1000;
    case 'day':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

function buildAtTimestamp(date: string, time: string) {
  const iso = new Date(`${date}T${time}:00`).toISOString();
  if (Number.isNaN(Date.parse(iso))) {
    throw new Error('Invalid OpenClaw at schedule.');
  }
  return iso;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasOwn(value: Record<string, unknown> | null | undefined, key: string) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function trimToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeToolAllowlist(value?: readonly string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    const trimmed = trimToUndefined(entry);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function resolveSessionTarget(input: CronTaskCreateInput) {
  switch (input.sessionMode) {
    case 'custom': {
      const customSessionId = trimToUndefined(input.customSessionId);
      if (!customSessionId) {
        throw new Error('Custom session jobs require a session identifier.');
      }
      return `session:${customSessionId}`;
    }
    case 'current':
      return 'current';
    case 'main':
      return 'main';
    case 'isolated':
    default:
      return 'isolated';
  }
}

function buildOpenClawSchedule(
  input: CronTaskCreateInput,
  existingDefinition?: OpenClawCronTaskPayload,
) {
  const existingSchedule = asRecord(existingDefinition?.schedule);

  switch (input.scheduleMode) {
    case 'interval': {
      const intervalValue = input.scheduleConfig.intervalValue;
      const intervalUnit = input.scheduleConfig.intervalUnit;
      if (!intervalValue || !intervalUnit) {
        throw new Error('Interval cron tasks require interval value and unit.');
      }

      const schedule =
        existingSchedule?.kind === 'every'
          ? cloneJsonValue(existingSchedule)
          : ({} as Record<string, unknown>);
      schedule.kind = 'every';
      schedule.everyMs = toEveryMs(intervalValue, intervalUnit);

      return schedule;
    }
    case 'datetime': {
      const scheduledDate = input.scheduleConfig.scheduledDate;
      const scheduledTime = input.scheduleConfig.scheduledTime;
      if (!scheduledDate || !scheduledTime) {
        throw new Error('Datetime cron tasks require date and time.');
      }

      const schedule =
        existingSchedule?.kind === 'at'
          ? cloneJsonValue(existingSchedule)
          : ({} as Record<string, unknown>);
      schedule.kind = 'at';
      schedule.at = buildAtTimestamp(scheduledDate, scheduledTime);
      delete schedule.tz;
      delete schedule.staggerMs;

      return schedule;
    }
    case 'cron':
    default: {
      const schedule =
        existingSchedule?.kind === 'cron'
          ? cloneJsonValue(existingSchedule)
          : ({} as Record<string, unknown>);
      schedule.kind = 'cron';
      schedule.expr = input.cronExpression || input.schedule;

      const cronTimezone = trimToUndefined(input.scheduleConfig.cronTimezone);
      if (cronTimezone) {
        schedule.tz = cronTimezone;
      } else {
        delete schedule.tz;
      }

      if (typeof input.scheduleConfig.staggerMs === 'number') {
        schedule.staggerMs = input.scheduleConfig.staggerMs;
      } else {
        delete schedule.staggerMs;
      }

      return schedule;
    }
  }
}

function getPayloadKind(executionContent: TaskExecutionContent) {
  return executionContent === 'sendPromptMessage' ? 'systemEvent' : 'agentTurn';
}

function buildOpenClawPayload(
  input: CronTaskCreateInput,
  sessionTarget: string,
  existingDefinition?: OpenClawCronTaskPayload,
) {
  const payloadKind = getPayloadKind(input.executionContent);
  const existingPayload = asRecord(existingDefinition?.payload);
  const payload =
    existingPayload?.kind === payloadKind
      ? cloneJsonValue(existingPayload)
      : ({} as Record<string, unknown>);

  if (sessionTarget === 'main' && payloadKind === 'agentTurn') {
    throw new Error('Main session jobs require systemEvent payloads.');
  }

  if (sessionTarget !== 'main' && payloadKind === 'systemEvent') {
    throw new Error('Isolated jobs require agentTurn payloads.');
  }

  if (payloadKind === 'systemEvent') {
    payload.kind = 'systemEvent';
    payload.text = input.prompt;
    const model = trimToUndefined(input.model);
    if (model) {
      payload.model = model;
    } else {
      delete payload.model;
    }
    delete payload.message;
    delete payload.timeoutSeconds;
    delete payload.thinking;
    delete payload.lightContext;
    delete payload.tools;
    return payload;
  }

  payload.kind = 'agentTurn';
  payload.message = input.prompt;

  const model = trimToUndefined(input.model);
  if (model) {
    payload.model = model;
  } else {
    delete payload.model;
  }

  const thinking = trimToUndefined(input.thinking);
  if (thinking) {
    payload.thinking = thinking;
  } else {
    delete payload.thinking;
  }

  if (typeof input.timeoutSeconds === 'number') {
    payload.timeoutSeconds = input.timeoutSeconds;
  } else {
    delete payload.timeoutSeconds;
  }

  if (input.lightContext) {
    payload.lightContext = true;
  } else {
    delete payload.lightContext;
  }

  if (Array.isArray(input.toolAllowlist)) {
    const toolAllowlist = normalizeToolAllowlist(input.toolAllowlist);
    if (toolAllowlist.length > 0) {
      payload.tools = toolAllowlist;
    } else {
      delete payload.tools;
    }
  }

  delete payload.text;
  return payload;
}

function buildDelivery(
  input: CronTaskCreateInput,
  sessionTarget: string,
  existingDefinition?: OpenClawCronTaskPayload,
) {
  const targetMode =
    input.deliveryMode === 'publishSummary'
      ? 'announce'
      : input.deliveryMode === 'webhook'
        ? 'webhook'
        : 'none';
  const existingDelivery = asRecord(existingDefinition?.delivery);
  const delivery =
    existingDelivery?.mode === targetMode
      ? cloneJsonValue(existingDelivery)
      : ({} as Record<string, unknown>);

  if (sessionTarget === 'main' && targetMode === 'announce') {
    throw new Error('Main session jobs do not support announce delivery.');
  }

  delivery.mode = targetMode;

  if (targetMode === 'none') {
    if (sessionTarget === 'main' && !hasOwn(existingDefinition, 'delivery')) {
      return undefined;
    }
    delete delivery.channel;
    delete delivery.to;
    delete delivery.bestEffort;
    return delivery;
  }

  if (targetMode === 'webhook') {
    const target = trimToUndefined(input.recipient);
    if (!target) {
      throw new Error('Webhook delivery requires a target URL.');
    }

    delivery.to = target;
    if (input.deliveryBestEffort) {
      delivery.bestEffort = true;
    } else {
      delete delivery.bestEffort;
    }
    delete delivery.channel;
    return delivery;
  }

  const deliveryChannel = trimToUndefined(input.deliveryChannel);
  const recipient = trimToUndefined(input.recipient);
  if (deliveryChannel) {
    delivery.channel = deliveryChannel;
  } else {
    delete delivery.channel;
  }
  if (recipient) {
    delivery.to = recipient;
  } else {
    delete delivery.to;
  }
  if (input.deliveryBestEffort) {
    delivery.bestEffort = true;
  } else {
    delete delivery.bestEffort;
  }

  return delivery;
}

export function cloneOpenClawCronTaskPayload(payload?: OpenClawCronTaskPayload) {
  return payload ? cloneJsonValue(payload) : undefined;
}

export function buildOpenClawCronTaskPayload(
  input: CronTaskCreateInput,
  existingDefinition?: OpenClawCronTaskPayload,
): OpenClawCronTaskPayload {
  const sessionTarget = resolveSessionTarget(input);
  const payload = buildOpenClawPayload(input, sessionTarget, existingDefinition);
  const delivery = buildDelivery(input, sessionTarget, existingDefinition);
  const root: OpenClawCronTaskPayload = {
    name: input.name,
    enabled: input.status === 'active',
    schedule: buildOpenClawSchedule(input, existingDefinition),
    sessionTarget,
    wakeMode: input.wakeUpMode === 'nextCycle' ? 'next-heartbeat' : 'now',
    payload,
  };

  if (delivery) {
    root.delivery = delivery;
  }

  const description = trimToUndefined(input.description);
  if (description) {
    root.description = description;
  } else if (hasOwn(existingDefinition, 'description')) {
    root.description = null;
  }

  const agentId = trimToUndefined(input.agentId);
  if (agentId) {
    root.agentId = agentId;
  } else if (hasOwn(existingDefinition, 'agentId')) {
    root.agentId = null;
  }

  if (input.deleteAfterRun || input.scheduleMode === 'datetime' || hasOwn(existingDefinition, 'deleteAfterRun')) {
    root.deleteAfterRun =
      input.deleteAfterRun === true ||
      (input.scheduleMode === 'datetime' && input.deleteAfterRun !== false);
  }

  return root;
}
