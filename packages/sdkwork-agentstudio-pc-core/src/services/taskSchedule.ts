export type TaskActionType = 'message' | 'skill';
export type TaskStatus = 'active' | 'paused' | 'failed';
export type TaskScheduleMode = 'interval' | 'datetime' | 'cron';
export type TaskIntervalUnit = 'minute' | 'hour' | 'day';
export type TaskSessionMode = 'isolated' | 'main' | 'current' | 'custom';
export type TaskWakeUpMode = 'immediate' | 'nextCycle';
export type TaskExecutionContent = 'runAssistantTask' | 'sendPromptMessage';
export type TaskDeliveryMode = 'publishSummary' | 'webhook' | 'none';
export type TaskThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export const taskThinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const satisfies readonly TaskThinkingLevel[];

export function isTaskThinkingLevel(value: string): value is TaskThinkingLevel {
  return taskThinkingLevels.some((level) => level === value);
}

export interface TaskScheduleConfig {
  intervalValue?: number;
  intervalUnit?: TaskIntervalUnit;
  scheduledDate?: string;
  scheduledTime?: string;
  cronExpression?: string;
  cronTimezone?: string;
  staggerMs?: number;
}

export interface SerializedTaskSchedule {
  schedule: string;
  cronExpression?: string;
  scheduleMode: TaskScheduleMode;
  scheduleConfig: TaskScheduleConfig;
}

export interface TaskExecutionConfig {
  sessionMode: TaskSessionMode;
  customSessionId?: string;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds?: number;
  deleteAfterRun?: boolean;
  agentId?: string;
  model?: string;
  thinking?: TaskThinkingLevel;
  lightContext?: boolean;
  toolAllowlist?: string[];
  deliveryMode: TaskDeliveryMode;
  deliveryBestEffort?: boolean;
  deliveryChannel?: string;
  recipient?: string;
}

export interface TaskFormValues {
  name: string;
  description: string;
  prompt: string;
  actionType: TaskActionType;
  enabled: boolean;
  scheduleMode: TaskScheduleMode;
  intervalValue: string;
  intervalUnit: TaskIntervalUnit;
  scheduledDate: string;
  scheduledTime: string;
  cronExpression: string;
  cronTimezone: string;
  staggerMs: string;
  sessionMode: TaskSessionMode;
  customSessionId: string;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds: string;
  deleteAfterRun: boolean;
  agentId: string;
  model: string;
  thinking: TaskThinkingLevel | '';
  lightContext: boolean;
  toolAllowlist: string;
  deliveryMode: TaskDeliveryMode;
  deliveryBestEffort: boolean;
  deliveryChannel: string;
  recipient: string;
}

export type TaskFormErrorKey =
  | 'name'
  | 'prompt'
  | 'intervalValue'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'cronExpression'
  | 'staggerMs'
  | 'customSessionId'
  | 'timeoutSeconds'
  | 'recipient';

export type TaskFormErrors = Partial<Record<TaskFormErrorKey, 'required' | 'invalid'>>;

export interface TaskCreateInput extends SerializedTaskSchedule, TaskExecutionConfig {
  name: string;
  description?: string;
  prompt: string;
  actionType: TaskActionType;
  status: TaskStatus;
}

export function createDefaultTaskFormValues(): TaskFormValues {
  return {
    name: '',
    description: '',
    prompt: '',
    actionType: 'skill',
    enabled: true,
    scheduleMode: 'interval',
    intervalValue: '30',
    intervalUnit: 'minute',
    scheduledDate: '',
    scheduledTime: '09:00',
    cronExpression: '0 9 * * *',
    cronTimezone: '',
    staggerMs: '',
    sessionMode: 'isolated',
    customSessionId: '',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: '',
    deleteAfterRun: true,
    agentId: '',
    model: '',
    thinking: '',
    lightContext: false,
    toolAllowlist: '',
    deliveryMode: 'publishSummary',
    deliveryBestEffort: false,
    deliveryChannel: '',
    recipient: '',
  };
}

function normalizeTaskToolAllowlistEntries(entries: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizeTaskToolAllowlist(raw: string) {
  return normalizeTaskToolAllowlistEntries(raw.split(/\r?\n/g));
}

export function formatTaskToolAllowlist(entries?: readonly string[] | null) {
  if (!entries?.length) {
    return '';
  }

  return normalizeTaskToolAllowlistEntries([...entries]).join('\n');
}

export function supportsTaskToolAllowlistConfig(
  sessionMode: TaskSessionMode,
  executionContent: TaskExecutionContent,
) {
  return (
    executionContent === 'runAssistantTask' &&
    (sessionMode === 'isolated' || sessionMode === 'custom')
  );
}

function parsePositiveInteger(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseNonNegativeInteger(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function normalizeTimeSegment(segment: string) {
  return String(Number(segment));
}

function isValidCronExpression(expression: string) {
  const parts = expression.trim().split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

function isValidWebhookTarget(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildIntervalCronExpression(value: number, unit: TaskIntervalUnit) {
  switch (unit) {
    case 'minute':
      return value <= 59 ? `*/${value} * * * *` : undefined;
    case 'hour':
      return value <= 23 ? `0 */${value} * * *` : undefined;
    case 'day':
      return value <= 31 ? `0 0 */${value} * *` : undefined;
    default:
      return undefined;
  }
}

function assertNoErrors(errors: TaskFormErrors) {
  if (Object.keys(errors).length > 0) {
    throw new Error(`Invalid task form: ${JSON.stringify(errors)}`);
  }
}

export function getActionTypeFromExecutionContent(
  executionContent: TaskExecutionContent,
): TaskActionType {
  return executionContent === 'sendPromptMessage' ? 'message' : 'skill';
}

function collectScheduleErrors(values: TaskFormValues): TaskFormErrors {
  const errors: TaskFormErrors = {};

  switch (values.scheduleMode) {
    case 'interval': {
      if (!values.intervalValue.trim()) {
        errors.intervalValue = 'required';
      } else if (parsePositiveInteger(values.intervalValue) == null) {
        errors.intervalValue = 'invalid';
      }
      break;
    }
    case 'datetime': {
      if (!values.scheduledDate.trim()) {
        errors.scheduledDate = 'required';
      }
      if (!values.scheduledTime.trim()) {
        errors.scheduledTime = 'required';
      }
      break;
    }
    case 'cron': {
      if (!values.cronExpression.trim()) {
        errors.cronExpression = 'required';
      } else if (!isValidCronExpression(values.cronExpression)) {
        errors.cronExpression = 'invalid';
      }

      if (values.staggerMs.trim()) {
        const staggerMs = parseNonNegativeInteger(values.staggerMs);
        if (staggerMs == null) {
          errors.staggerMs = 'invalid';
        }
      }
      break;
    }
  }

  return errors;
}

export function collectTaskFormErrors(values: TaskFormValues): TaskFormErrors {
  const errors = collectScheduleErrors(values);

  if (!values.name.trim()) {
    errors.name = 'required';
  }

  if (!values.prompt.trim()) {
    errors.prompt = 'required';
  }

  if (values.sessionMode === 'custom' && !values.customSessionId.trim()) {
    errors.customSessionId = 'required';
  }

  if (values.timeoutSeconds.trim()) {
    const timeout = parsePositiveInteger(values.timeoutSeconds);
    if (timeout == null) {
      errors.timeoutSeconds = 'invalid';
    }
  }

  if (values.deliveryMode === 'webhook') {
    if (!values.recipient.trim()) {
      errors.recipient = 'required';
    } else if (!isValidWebhookTarget(values.recipient.trim())) {
      errors.recipient = 'invalid';
    }
  }

  return errors;
}

export function serializeTaskSchedule(values: TaskFormValues): SerializedTaskSchedule {
  const errors = collectScheduleErrors(values);
  assertNoErrors(errors);

  if (values.scheduleMode === 'interval') {
    const intervalValue = parsePositiveInteger(values.intervalValue)!;

    return {
      schedule: `@every ${intervalValue}${values.intervalUnit[0]}`,
      cronExpression: buildIntervalCronExpression(intervalValue, values.intervalUnit),
      scheduleMode: 'interval',
      scheduleConfig: {
        intervalValue,
        intervalUnit: values.intervalUnit,
      },
    };
  }

  if (values.scheduleMode === 'datetime') {
    const [, month, day] = values.scheduledDate.split('-');
    const [hour, minute] = values.scheduledTime.split(':');

    return {
      schedule: `at ${values.scheduledDate} ${values.scheduledTime}`,
      cronExpression: `${normalizeTimeSegment(minute)} ${normalizeTimeSegment(hour)} ${normalizeTimeSegment(day)} ${normalizeTimeSegment(month)} *`,
      scheduleMode: 'datetime',
      scheduleConfig: {
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime,
      },
    };
  }

  const cronTimezone = values.cronTimezone.trim();
  const staggerMs = values.staggerMs.trim()
    ? parseNonNegativeInteger(values.staggerMs) ?? undefined
    : undefined;

  return {
    schedule: values.cronExpression.trim(),
    cronExpression: values.cronExpression.trim(),
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: values.cronExpression.trim(),
      cronTimezone: cronTimezone || undefined,
      staggerMs,
    },
  };
}

export function buildCreateTaskInput(values: TaskFormValues): TaskCreateInput {
  const serializedSchedule = serializeTaskSchedule(values);
  const errors = collectTaskFormErrors(values);
  assertNoErrors(errors);

  const description = values.description.trim();
  const customSessionId = values.customSessionId.trim();
  const agentId = values.agentId.trim();
  const model = values.model.trim();
  const recipient = values.recipient.trim();
  const timeoutSeconds = values.timeoutSeconds.trim()
    ? parsePositiveInteger(values.timeoutSeconds) ?? undefined
    : undefined;
  const toolAllowlist = supportsTaskToolAllowlistConfig(
    values.sessionMode,
    values.executionContent,
  )
    ? normalizeTaskToolAllowlist(values.toolAllowlist)
    : undefined;

  return {
    name: values.name.trim(),
    description: description || undefined,
    prompt: values.prompt.trim(),
    actionType: getActionTypeFromExecutionContent(values.executionContent),
    status: values.enabled ? 'active' : 'paused',
    sessionMode: values.sessionMode,
    customSessionId: customSessionId || undefined,
    wakeUpMode: values.wakeUpMode,
    executionContent: values.executionContent,
    timeoutSeconds,
    deleteAfterRun: values.deleteAfterRun,
    agentId: agentId || undefined,
    model: model || undefined,
    thinking: values.thinking || undefined,
    lightContext: values.lightContext,
    toolAllowlist,
    deliveryMode: values.deliveryMode,
    deliveryBestEffort: values.deliveryBestEffort,
    deliveryChannel: values.deliveryChannel || undefined,
    recipient: recipient || undefined,
    ...serializedSchedule,
  };
}
