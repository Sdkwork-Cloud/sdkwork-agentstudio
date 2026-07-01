import type {
  InstanceWorkbenchTask,
  InstanceWorkbenchTaskExecution,
} from '../types/index.ts';
import {
  getBooleanValue,
  getNumberValue,
  getObjectValue,
  getStringValue,
  isRecord,
  normalizeOpenClawAgentId,
  titleCaseIdentifier,
} from './openClawSupport.ts';

function cloneTaskExecution(
  execution: InstanceWorkbenchTaskExecution,
): InstanceWorkbenchTaskExecution {
  return { ...execution };
}

function cloneWorkbenchRawDefinition(rawDefinition: Record<string, unknown> | undefined) {
  return rawDefinition
    ? JSON.parse(JSON.stringify(rawDefinition)) as Record<string, unknown>
    : undefined;
}

function isWorkbenchTaskScheduleMode(
  value: unknown,
): value is InstanceWorkbenchTask['scheduleMode'] {
  return value === 'interval' || value === 'datetime' || value === 'cron';
}

function isWorkbenchTaskActionType(
  value: unknown,
): value is InstanceWorkbenchTask['actionType'] {
  return value === 'message' || value === 'skill';
}

function isWorkbenchTaskStatus(
  value: unknown,
): value is InstanceWorkbenchTask['status'] {
  return value === 'active' || value === 'paused' || value === 'failed';
}

function isWorkbenchTaskSessionMode(
  value: unknown,
): value is InstanceWorkbenchTask['sessionMode'] {
  return value === 'isolated' || value === 'main' || value === 'current' || value === 'custom';
}

function isWorkbenchTaskWakeUpMode(
  value: unknown,
): value is InstanceWorkbenchTask['wakeUpMode'] {
  return value === 'immediate' || value === 'nextCycle';
}

function isWorkbenchTaskExecutionContent(
  value: unknown,
): value is InstanceWorkbenchTask['executionContent'] {
  return value === 'runAssistantTask' || value === 'sendPromptMessage';
}

function isWorkbenchTaskDeliveryMode(
  value: unknown,
): value is InstanceWorkbenchTask['deliveryMode'] {
  return value === 'publishSummary' || value === 'webhook' || value === 'none';
}

function isWorkbenchTaskThinking(
  value: unknown,
): value is InstanceWorkbenchTask['thinking'] {
  return (
    value === 'off' ||
    value === 'minimal' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'xhigh'
  );
}

function isWorkbenchTaskExecutionStatus(
  value: unknown,
): value is InstanceWorkbenchTaskExecution['status'] {
  return value === 'success' || value === 'failed' || value === 'running';
}

function isWorkbenchTaskExecutionTrigger(
  value: unknown,
): value is InstanceWorkbenchTaskExecution['trigger'] {
  return value === 'schedule' || value === 'manual' || value === 'clone';
}

export function normalizeWorkbenchTaskExecution(
  execution: unknown,
  taskId: string,
): InstanceWorkbenchTaskExecution | null {
  if (!isRecord(execution)) {
    return null;
  }

  const startedAt = getStringValue(execution, ['startedAt']);
  const status = isWorkbenchTaskExecutionStatus(execution.status) ? execution.status : null;
  if (!startedAt || !status) {
    return null;
  }

  return {
    id: getStringValue(execution, ['id']) || `${taskId}-latest`,
    taskId: getStringValue(execution, ['taskId']) || taskId,
    status,
    trigger: isWorkbenchTaskExecutionTrigger(execution.trigger) ? execution.trigger : 'schedule',
    startedAt,
    finishedAt: getStringValue(execution, ['finishedAt']),
    summary: getStringValue(execution, ['summary']) || 'Task execution recorded.',
    details: getStringValue(execution, ['details']),
  };
}

export function normalizeWorkbenchTask(task: unknown): InstanceWorkbenchTask | null {
  if (!isRecord(task)) {
    return null;
  }

  const id = getStringValue(task, ['id']);
  if (!id) {
    return null;
  }

  const scheduleConfig = getObjectValue(task, ['scheduleConfig']) || {};
  const agentId = getStringValue(task, ['agentId']);
  const rawDefinition = getObjectValue(task, ['rawDefinition']);
  const hasLatestExecution = Object.prototype.hasOwnProperty.call(task, 'latestExecution');
  const latestExecutionValue = hasLatestExecution ? task.latestExecution : undefined;

  return {
    ...(task as unknown as InstanceWorkbenchTask),
    id,
    name: getStringValue(task, ['name']) || titleCaseIdentifier(id),
    description: getStringValue(task, ['description']),
    prompt: getStringValue(task, ['prompt']) as InstanceWorkbenchTask['prompt'],
    schedule: getStringValue(task, ['schedule']) as InstanceWorkbenchTask['schedule'],
    scheduleMode: isWorkbenchTaskScheduleMode(task.scheduleMode)
      ? task.scheduleMode
      : (task.scheduleMode as InstanceWorkbenchTask['scheduleMode']),
    scheduleConfig: { ...scheduleConfig },
    cronExpression: getStringValue(task, ['cronExpression']),
    actionType: isWorkbenchTaskActionType(task.actionType)
      ? task.actionType
      : (task.actionType as InstanceWorkbenchTask['actionType']),
    status: isWorkbenchTaskStatus(task.status)
      ? task.status
      : (task.status as InstanceWorkbenchTask['status']),
    sessionMode: isWorkbenchTaskSessionMode(task.sessionMode)
      ? task.sessionMode
      : (task.sessionMode as InstanceWorkbenchTask['sessionMode']),
    customSessionId: getStringValue(task, ['customSessionId']),
    wakeUpMode: isWorkbenchTaskWakeUpMode(task.wakeUpMode)
      ? task.wakeUpMode
      : (task.wakeUpMode as InstanceWorkbenchTask['wakeUpMode']),
    executionContent: isWorkbenchTaskExecutionContent(task.executionContent)
      ? task.executionContent
      : (task.executionContent as InstanceWorkbenchTask['executionContent']),
    timeoutSeconds: getNumberValue(task, ['timeoutSeconds']),
    deleteAfterRun: getBooleanValue(task, ['deleteAfterRun']),
    agentId: agentId ? normalizeOpenClawAgentId(agentId) : undefined,
    model: getStringValue(task, ['model']),
    thinking: isWorkbenchTaskThinking(task.thinking)
      ? task.thinking
      : (task.thinking as InstanceWorkbenchTask['thinking']),
    lightContext: getBooleanValue(task, ['lightContext']),
    deliveryMode: isWorkbenchTaskDeliveryMode(task.deliveryMode)
      ? task.deliveryMode
      : (task.deliveryMode as InstanceWorkbenchTask['deliveryMode']),
    deliveryBestEffort: getBooleanValue(task, ['deliveryBestEffort']),
    deliveryChannel: getStringValue(task, ['deliveryChannel']),
    deliveryLabel: getStringValue(task, ['deliveryLabel']),
    recipient: getStringValue(task, ['recipient']),
    lastRun: getStringValue(task, ['lastRun']),
    nextRun: getStringValue(task, ['nextRun']),
    latestExecution: hasLatestExecution
      ? latestExecutionValue === null
        ? null
        : latestExecutionValue === undefined
          ? undefined
          : normalizeWorkbenchTaskExecution(latestExecutionValue, id)
      : undefined,
    rawDefinition: cloneWorkbenchRawDefinition(rawDefinition),
  };
}

export function cloneWorkbenchTask(task: InstanceWorkbenchTask): InstanceWorkbenchTask {
  const normalizedTask = normalizeWorkbenchTask(task);
  if (!normalizedTask) {
    return {
      ...(task as InstanceWorkbenchTask),
      scheduleConfig: {},
      latestExecution: null,
    };
  }

  const hasLatestExecution = Object.prototype.hasOwnProperty.call(
    normalizedTask,
    'latestExecution',
  );

  return {
    ...normalizedTask,
    scheduleConfig: { ...normalizedTask.scheduleConfig },
    latestExecution: hasLatestExecution
      ? normalizedTask.latestExecution
        ? cloneTaskExecution(normalizedTask.latestExecution)
        : normalizedTask.latestExecution
      : undefined,
    rawDefinition: cloneWorkbenchRawDefinition(normalizedTask.rawDefinition),
  };
}

export function mergeWorkbenchTasks(
  baseTask: InstanceWorkbenchTask,
  overrideTask: InstanceWorkbenchTask,
): InstanceWorkbenchTask {
  const mergedTask = {
    ...baseTask,
    ...overrideTask,
    id: getStringValue(overrideTask, ['id']) || baseTask.id,
    name: getStringValue(overrideTask, ['name']) || baseTask.name,
    description: getStringValue(overrideTask, ['description']) || baseTask.description,
    prompt: getStringValue(overrideTask, ['prompt']) || baseTask.prompt,
    schedule: getStringValue(overrideTask, ['schedule']) || baseTask.schedule,
    scheduleMode: isWorkbenchTaskScheduleMode(overrideTask.scheduleMode)
      ? overrideTask.scheduleMode
      : baseTask.scheduleMode,
    scheduleConfig: {
      ...baseTask.scheduleConfig,
      ...(isRecord(overrideTask.scheduleConfig) ? overrideTask.scheduleConfig : {}),
    },
    cronExpression: getStringValue(overrideTask, ['cronExpression']) || baseTask.cronExpression,
    actionType: isWorkbenchTaskActionType(overrideTask.actionType)
      ? overrideTask.actionType
      : baseTask.actionType,
    status: isWorkbenchTaskStatus(overrideTask.status) ? overrideTask.status : baseTask.status,
    sessionMode: isWorkbenchTaskSessionMode(overrideTask.sessionMode)
      ? overrideTask.sessionMode
      : baseTask.sessionMode,
    customSessionId: getStringValue(overrideTask, ['customSessionId']) || baseTask.customSessionId,
    wakeUpMode: isWorkbenchTaskWakeUpMode(overrideTask.wakeUpMode)
      ? overrideTask.wakeUpMode
      : baseTask.wakeUpMode,
    executionContent: isWorkbenchTaskExecutionContent(overrideTask.executionContent)
      ? overrideTask.executionContent
      : baseTask.executionContent,
    timeoutSeconds:
      getNumberValue(overrideTask, ['timeoutSeconds']) ?? baseTask.timeoutSeconds,
    deleteAfterRun:
      getBooleanValue(overrideTask, ['deleteAfterRun']) ?? baseTask.deleteAfterRun,
    agentId:
      (getStringValue(overrideTask, ['agentId'])
        ? normalizeOpenClawAgentId(getStringValue(overrideTask, ['agentId']))
        : undefined) || baseTask.agentId,
    model: getStringValue(overrideTask, ['model']) || baseTask.model,
    thinking: isWorkbenchTaskThinking(overrideTask.thinking)
      ? overrideTask.thinking
      : baseTask.thinking,
    lightContext:
      getBooleanValue(overrideTask, ['lightContext']) ?? baseTask.lightContext,
    deliveryMode: isWorkbenchTaskDeliveryMode(overrideTask.deliveryMode)
      ? overrideTask.deliveryMode
      : baseTask.deliveryMode,
    deliveryBestEffort:
      getBooleanValue(overrideTask, ['deliveryBestEffort']) ?? baseTask.deliveryBestEffort,
    deliveryChannel:
      getStringValue(overrideTask, ['deliveryChannel']) || baseTask.deliveryChannel,
    deliveryLabel:
      getStringValue(overrideTask, ['deliveryLabel']) || baseTask.deliveryLabel,
    recipient: getStringValue(overrideTask, ['recipient']) || baseTask.recipient,
    lastRun: getStringValue(overrideTask, ['lastRun']) || baseTask.lastRun,
    nextRun: getStringValue(overrideTask, ['nextRun']) || baseTask.nextRun,
    latestExecution:
      overrideTask.latestExecution === undefined
        ? baseTask.latestExecution
        : overrideTask.latestExecution
          ? cloneTaskExecution(overrideTask.latestExecution)
          : overrideTask.latestExecution,
    rawDefinition:
      cloneWorkbenchRawDefinition(overrideTask.rawDefinition) ||
      cloneWorkbenchRawDefinition(baseTask.rawDefinition),
  } satisfies InstanceWorkbenchTask;

  return cloneWorkbenchTask(mergedTask);
}

export function normalizeWorkbenchTaskCollection(
  tasks: InstanceWorkbenchTask[],
): InstanceWorkbenchTask[] {
  const orderedIds: string[] = [];
  const normalizedTasks = new Map<string, InstanceWorkbenchTask>();

  tasks.forEach((task) => {
    const normalizedTask = normalizeWorkbenchTask(task);
    if (!normalizedTask) {
      return;
    }

    const current = normalizedTasks.get(normalizedTask.id);
    if (!current) {
      orderedIds.push(normalizedTask.id);
      normalizedTasks.set(normalizedTask.id, normalizedTask);
      return;
    }

    normalizedTasks.set(normalizedTask.id, mergeWorkbenchTasks(current, normalizedTask));
  });

  return orderedIds
    .map((taskId) => normalizedTasks.get(taskId))
    .filter(Boolean) as InstanceWorkbenchTask[];
}
