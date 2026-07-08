import type { Task, TaskExecutionHistoryEntry } from './taskService.ts';

export interface TaskExecutionFeedEntry extends TaskExecutionHistoryEntry {
  taskName: string;
  taskStatus: Task['status'];
  taskSchedule: string;
}

function parseStartedAt(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function isTaskExecutionFeedReady(
  tasks: Task[],
  executionsByTaskId: Record<string, TaskExecutionHistoryEntry[]>,
) {
  return tasks.every((task) => task.id in executionsByTaskId);
}

export function buildTaskExecutionFeed(
  tasks: Task[],
  executionsByTaskId: Record<string, TaskExecutionHistoryEntry[]>,
): TaskExecutionFeedEntry[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task] as const));

  return Object.entries(executionsByTaskId)
    .flatMap(([taskId, executions]) => {
      const task = tasksById.get(taskId);
      if (!task) {
        return [];
      }

      return executions.map((execution) => ({
        ...execution,
        taskName: task.name,
        taskStatus: task.status,
        taskSchedule: task.schedule,
      }));
    })
    .sort((left, right) => parseStartedAt(right.startedAt) - parseStartedAt(left.startedAt));
}
