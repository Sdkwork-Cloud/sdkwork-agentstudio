import type { Task, TaskExecutionHistoryEntry } from './taskService.ts';

export type TaskCardTone = 'healthy' | 'paused' | 'danger';

export interface TaskCardState {
  tone: TaskCardTone;
  latestExecution: TaskExecutionHistoryEntry | null;
  canRunNow: boolean;
  nextRunLabel: string;
  promptExcerpt: string;
  summaryText: string;
  latestExecutionSummary: string | null;
}

function getTaskCardTone(
  status: Task['status'],
  latestExecutionStatus?: TaskExecutionHistoryEntry['status'],
): TaskCardTone {
  if (status === 'failed' || latestExecutionStatus === 'failed') {
    return 'danger';
  }
  if (status === 'paused') {
    return 'paused';
  }
  return 'healthy';
}

export function getTaskPreview(prompt?: string, maxLength = 160) {
  const normalized = (prompt || '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function buildTaskCardState(
  task: Task,
  executions: TaskExecutionHistoryEntry[],
): TaskCardState {
  const latestExecution = executions[0] || null;
  const promptExcerpt = getTaskPreview(task.prompt, 160);

  return {
    tone: getTaskCardTone(task.status, latestExecution?.status),
    latestExecution,
    canRunNow: true,
    nextRunLabel: task.nextRun || '-',
    promptExcerpt,
    summaryText: task.description?.trim() || promptExcerpt,
    latestExecutionSummary: latestExecution?.summary || null,
  };
}
