import type { Task } from './taskService.ts';
import {
  createDefaultTaskFormValues,
  formatTaskToolAllowlist,
  type TaskFormValues,
} from './taskSchedule.ts';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readSessionSelectionFromRawDefinition(task: Task) {
  const rawDefinition = asRecord(task.rawDefinition);
  const sessionTarget = typeof rawDefinition?.sessionTarget === 'string'
    ? rawDefinition.sessionTarget.trim()
    : '';

  if (sessionTarget === 'main') {
    return {
      sessionMode: 'main' as const,
      customSessionId: '',
    };
  }

  if (sessionTarget === 'current') {
    return {
      sessionMode: 'current' as const,
      customSessionId: '',
    };
  }

  if (sessionTarget.startsWith('session:')) {
    return {
      sessionMode: 'custom' as const,
      customSessionId: sessionTarget.slice('session:'.length),
    };
  }

  return {
    sessionMode: task.sessionMode,
    customSessionId: task.customSessionId || '',
  };
}

function readToolAllowlistFromRawDefinition(task: Task) {
  const rawDefinition = asRecord(task.rawDefinition);
  const payload = asRecord(rawDefinition?.payload);
  const toolAllowlist = Array.isArray(payload?.tools)
    ? payload.tools.filter((value): value is string => typeof value === 'string')
    : task.toolAllowlist;

  return formatTaskToolAllowlist(toolAllowlist);
}

export function buildTaskFormValuesFromTask(task: Task): TaskFormValues {
  const defaults = createDefaultTaskFormValues();
  const sessionSelection = readSessionSelectionFromRawDefinition(task);

  return {
    ...defaults,
    name: task.name,
    description: task.description || '',
    prompt: task.prompt,
    actionType: task.actionType,
    enabled: task.status !== 'paused',
    scheduleMode: task.scheduleMode,
    intervalValue: task.scheduleConfig.intervalValue
      ? String(task.scheduleConfig.intervalValue)
      : defaults.intervalValue,
    intervalUnit: task.scheduleConfig.intervalUnit || defaults.intervalUnit,
    scheduledDate: task.scheduleConfig.scheduledDate || '',
    scheduledTime: task.scheduleConfig.scheduledTime || defaults.scheduledTime,
    cronExpression: task.cronExpression || task.scheduleConfig.cronExpression || defaults.cronExpression,
    cronTimezone: task.scheduleConfig.cronTimezone || '',
    staggerMs:
      typeof task.scheduleConfig.staggerMs === 'number' ? String(task.scheduleConfig.staggerMs) : '',
    sessionMode: sessionSelection.sessionMode,
    customSessionId: sessionSelection.customSessionId,
    wakeUpMode: task.wakeUpMode,
    executionContent: task.executionContent,
    timeoutSeconds: task.timeoutSeconds ? String(task.timeoutSeconds) : '',
    deleteAfterRun:
      typeof task.deleteAfterRun === 'boolean'
        ? task.deleteAfterRun
        : task.scheduleMode === 'datetime',
    agentId: task.agentId || '',
    model: task.model || '',
    thinking: task.thinking || '',
    lightContext: Boolean(task.lightContext),
    toolAllowlist: readToolAllowlistFromRawDefinition(task),
    deliveryMode: task.deliveryMode,
    deliveryBestEffort: Boolean(task.deliveryBestEffort),
    deliveryChannel: task.deliveryChannel || '',
    recipient: task.recipient || '',
  };
}
