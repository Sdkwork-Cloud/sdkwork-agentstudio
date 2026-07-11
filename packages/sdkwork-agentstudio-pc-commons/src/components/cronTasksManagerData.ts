import type {
  OpenClawAgentCatalog,
  TaskRuntimeOverview,
  Task,
  TaskDeliveryChannelOption,
  TaskExecutionHistoryEntry,
} from '@sdkwork/agentstudio-pc-core';

export interface LoadTaskStudioSnapshotInput {
  instanceId: string;
  historyTaskIds?: string[];
  includeEditorResources?: boolean;
  getTasks: (instanceId: string) => Promise<Task[]>;
  getTaskRuntimeOverview: (instanceId: string) => Promise<TaskRuntimeOverview>;
  listDeliveryChannels: (instanceId: string) => Promise<TaskDeliveryChannelOption[]>;
  getAgentCatalog: (instanceId: string) => Promise<OpenClawAgentCatalog>;
  listTaskExecutions: (
    instanceId: string,
    taskId: string,
  ) => Promise<TaskExecutionHistoryEntry[]>;
}

export interface TaskStudioSnapshot {
  tasks: Task[];
  taskRuntimeOverview: TaskRuntimeOverview;
  deliveryChannels: TaskDeliveryChannelOption[];
  agentCatalog: OpenClawAgentCatalog;
  executionsByTaskId: Record<string, TaskExecutionHistoryEntry[]>;
}

export async function loadTaskStudioSnapshot(
  input: LoadTaskStudioSnapshotInput,
): Promise<TaskStudioSnapshot> {
  const includeEditorResources = input.includeEditorResources !== false;
  const [tasks, taskRuntimeOverview, deliveryChannels, agentCatalog] = await Promise.all([
    input.getTasks(input.instanceId),
    input.getTaskRuntimeOverview(input.instanceId),
    includeEditorResources
      ? input.listDeliveryChannels(input.instanceId)
      : Promise.resolve([] as TaskDeliveryChannelOption[]),
    includeEditorResources
      ? input.getAgentCatalog(input.instanceId)
      : Promise.resolve({
          agents: [],
          defaultAgentId: null,
        } satisfies OpenClawAgentCatalog),
  ]);

  const availableTaskIds = new Set(tasks.map((task) => task.id));
  const historyTaskIds = Array.from(new Set((input.historyTaskIds || []).filter(Boolean))).filter(
    (taskId) => availableTaskIds.has(taskId),
  );

  const historyEntries = await Promise.all(
    historyTaskIds.map(
      async (taskId) => [taskId, await input.listTaskExecutions(input.instanceId, taskId)] as const,
    ),
  );

  return {
    tasks,
    taskRuntimeOverview,
    deliveryChannels,
    agentCatalog,
    executionsByTaskId: Object.fromEntries(historyEntries) as Record<
      string,
      TaskExecutionHistoryEntry[]
    >,
  };
}
