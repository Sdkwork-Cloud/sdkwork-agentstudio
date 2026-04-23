import { openClawGatewayClient, studio } from '@sdkwork/claw-infrastructure';
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
} from '@sdkwork/claw-types';
import {
  buildOpenClawCronTaskPayload,
  cloneOpenClawCronTaskPayload,
  type CronTaskCreateInput,
  type OpenClawCronTaskPayload,
} from './cronTaskPayload.ts';
import {
  canManageTasks,
  resolveTaskCrudSurface,
} from './taskSurfaceSupport.ts';
import type {
  TaskActionType,
  TaskDeliveryMode,
  TaskExecutionContent,
  TaskScheduleConfig,
  TaskScheduleMode,
  TaskSessionMode,
  TaskStatus,
  TaskThinkingLevel,
  TaskWakeUpMode,
} from './taskSchedule.ts';

export interface Task extends CronTaskCreateInput {
  id: string;
  deliveryLabel?: string;
  lastRun?: string;
  nextRun?: string;
  rawDefinition?: OpenClawCronTaskPayload;
}

export interface TaskExecutionHistoryEntry {
  id: string;
  taskId: string;
  status: 'success' | 'failed' | 'running';
  trigger: 'schedule' | 'manual' | 'clone';
  startedAt: string;
  finishedAt?: string;
  summary: string;
  details?: string;
}

export interface TaskDeliveryChannelOption {
  id: string;
  name: string;
}

export interface CreateTaskDTO {
  name: string;
  description?: string;
  prompt: string;
  schedule: string;
  scheduleMode: TaskScheduleMode;
  scheduleConfig: TaskScheduleConfig;
  cronExpression?: string;
  actionType: TaskActionType;
  status: TaskStatus;
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
  lastRun?: string;
  nextRun?: string;
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {}

export interface ITaskService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Task>>;
  getById(instanceId: string, id: string): Promise<Task | null>;
  create(instanceId: string, data: CreateTaskDTO): Promise<Task>;
  update(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  delete(id: string, instanceId?: string): Promise<boolean>;
  cloneTask(id: string, overrides?: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  runTaskNow(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry>;
  listTaskExecutions(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry[]>;
  listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]>;
  getTasks(instanceId: string): Promise<Task[]>;
  createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task>;
  updateTaskStatus(
    id: string,
    status: Extract<TaskStatus, 'active' | 'paused'>,
    instanceId?: string,
  ): Promise<void>;
  deleteTask(id: string, instanceId?: string): Promise<void>;
}

type TaskRouteMode = 'backend' | 'gateway';

type TaskRoute = {
  instanceId: string;
  mode: TaskRouteMode;
};

const TASK_MANAGEMENT_UNAVAILABLE_ERROR =
  'Task management is not available for this instance.';
const TASK_INSTANCE_CONTEXT_UNAVAILABLE_ERROR =
  'Failed to resolve the task instance context.';

function readToolAllowlistFromRawDefinition(
  rawDefinition?: OpenClawCronTaskPayload,
): string[] | undefined {
  const payload =
    rawDefinition?.payload &&
    typeof rawDefinition.payload === 'object' &&
    !Array.isArray(rawDefinition.payload)
      ? (rawDefinition.payload as Record<string, unknown>)
      : null;
  const tools = Array.isArray(payload?.tools)
    ? payload.tools.filter((value): value is string => typeof value === 'string')
    : undefined;

  return tools?.length ? [...tools] : undefined;
}

function cloneTaskRecord(task: Task): Task {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
    toolAllowlist: task.toolAllowlist ? [...task.toolAllowlist] : undefined,
    rawDefinition: cloneOpenClawCronTaskPayload(task.rawDefinition),
  };
}

function mapStudioTaskExecution(
  execution: StudioWorkbenchTaskExecutionRecord,
): TaskExecutionHistoryEntry {
  return { ...execution };
}

function mapStudioTask(task: StudioWorkbenchTaskRecord): Task {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    prompt: task.prompt,
    schedule: task.schedule,
    scheduleMode: task.scheduleMode,
    scheduleConfig: { ...task.scheduleConfig },
    cronExpression: task.cronExpression,
    actionType: task.actionType,
    status: task.status,
    sessionMode: task.sessionMode,
    customSessionId: task.customSessionId,
    wakeUpMode: task.wakeUpMode,
    executionContent: task.executionContent,
    timeoutSeconds: task.timeoutSeconds,
    deleteAfterRun: task.deleteAfterRun,
    agentId: task.agentId,
    model: task.model,
    thinking: task.thinking,
    lightContext: task.lightContext,
    toolAllowlist: readToolAllowlistFromRawDefinition(task.rawDefinition),
    deliveryMode: task.deliveryMode,
    deliveryBestEffort: task.deliveryBestEffort,
    deliveryChannel: task.deliveryChannel,
    deliveryLabel: task.deliveryLabel,
    recipient: task.recipient,
    lastRun: task.lastRun,
    nextRun: task.nextRun,
    rawDefinition: cloneOpenClawCronTaskPayload(task.rawDefinition),
  };
}

function normalizeId(id: string | null | undefined): string | null {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  return normalizedId || null;
}

function normalizeUniqueById<T extends { id: string }>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const normalizedItems: T[] = [];

  items.forEach((item) => {
    const normalizedId = normalizeId(item.id);
    if (!normalizedId || seenIds.has(normalizedId)) {
      return;
    }

    seenIds.add(normalizedId);
    normalizedItems.push(
      normalizedId === item.id
        ? item
        : ({
            ...item,
            id: normalizedId,
          } as T),
    );
  });

  return normalizedItems;
}

function toCreateTaskInput(task: Task, data: UpdateTaskDTO = {}): CreateTaskDTO {
  return {
    name: data.name ?? task.name,
    description: data.description ?? task.description,
    prompt: data.prompt ?? task.prompt,
    schedule: data.schedule ?? task.schedule,
    scheduleMode: data.scheduleMode ?? task.scheduleMode,
    scheduleConfig: data.scheduleConfig ?? task.scheduleConfig,
    cronExpression: data.cronExpression ?? task.cronExpression,
    actionType: data.actionType ?? task.actionType,
    status: data.status ?? task.status,
    sessionMode: data.sessionMode ?? task.sessionMode,
    customSessionId: data.customSessionId ?? task.customSessionId,
    wakeUpMode: data.wakeUpMode ?? task.wakeUpMode,
    executionContent: data.executionContent ?? task.executionContent,
    timeoutSeconds: data.timeoutSeconds ?? task.timeoutSeconds,
    deleteAfterRun: data.deleteAfterRun ?? task.deleteAfterRun,
    agentId: data.agentId ?? task.agentId,
    model: data.model ?? task.model,
    thinking: data.thinking ?? task.thinking,
    lightContext: data.lightContext ?? task.lightContext,
    toolAllowlist: data.toolAllowlist ?? task.toolAllowlist,
    deliveryMode: data.deliveryMode ?? task.deliveryMode,
    deliveryBestEffort: data.deliveryBestEffort ?? task.deliveryBestEffort,
    deliveryChannel: data.deliveryChannel ?? task.deliveryChannel,
    recipient: data.recipient ?? task.recipient,
    lastRun: data.lastRun ?? task.lastRun,
    nextRun: data.nextRun ?? task.nextRun,
  };
}

function mergeTaskCollections(
  backendTasks: Task[],
  gatewayTasks: Task[],
): Task[] {
  const normalizedBackendTasks = normalizeUniqueById(backendTasks).map(cloneTaskRecord);
  const normalizedGatewayTasks = normalizeUniqueById(gatewayTasks).map(cloneTaskRecord);
  const orderedIds: string[] = [];
  const mergedTasks = new Map<string, Task>();

  normalizedGatewayTasks.forEach((task) => {
    orderedIds.push(task.id);
    mergedTasks.set(task.id, cloneTaskRecord(task));
  });

  normalizedBackendTasks.forEach((task) => {
    if (!mergedTasks.has(task.id)) {
      orderedIds.push(task.id);
      mergedTasks.set(task.id, cloneTaskRecord(task));
    }
  });

  return orderedIds
    .map((taskId) => mergedTasks.get(taskId))
    .filter(Boolean) as Task[];
}

export class TaskService implements ITaskService {
  private readonly taskRouteById = new Map<string, TaskRoute>();
  private readonly taskRouteByScopedId = new Map<string, TaskRouteMode>();
  private readonly taskExecutionsByScopedId = new Map<string, TaskExecutionHistoryEntry[]>();

  private buildScopedTaskKey(instanceId: string, taskId: string) {
    return `${instanceId}::${taskId}`;
  }

  private findFallbackTaskRoute(taskId: string): TaskRoute | null {
    const scopedTaskSuffix = `::${taskId}`;
    const scopedRouteEntries = [...this.taskRouteByScopedId.entries()].reverse();

    for (const [scopedTaskKey, mode] of scopedRouteEntries) {
      if (!scopedTaskKey.endsWith(scopedTaskSuffix)) {
        continue;
      }

      return {
        instanceId: scopedTaskKey.slice(0, scopedTaskKey.length - scopedTaskSuffix.length),
        mode,
      };
    }

    return null;
  }

  private refreshFallbackTaskRoute(taskId: string) {
    const fallbackRoute = this.findFallbackTaskRoute(taskId);
    if (fallbackRoute) {
      this.taskRouteById.set(taskId, fallbackRoute);
      return;
    }

    this.taskRouteById.delete(taskId);
  }

  private clearTasksForInstance(instanceId: string) {
    const scopedTaskPrefix = `${instanceId}::`;

    for (const [scopedTaskKey] of [...this.taskRouteByScopedId.entries()]) {
      if (scopedTaskKey.startsWith(scopedTaskPrefix)) {
        this.taskRouteByScopedId.delete(scopedTaskKey);
      }
    }

    for (const [scopedTaskKey] of [...this.taskExecutionsByScopedId.entries()]) {
      if (scopedTaskKey.startsWith(scopedTaskPrefix)) {
        this.taskExecutionsByScopedId.delete(scopedTaskKey);
      }
    }

    for (const [taskId, route] of [...this.taskRouteById.entries()]) {
      if (route.instanceId === instanceId) {
        this.refreshFallbackTaskRoute(taskId);
      }
    }
  }

  private rememberTaskExecutions(
    instanceId: string,
    taskId: string,
    executions: TaskExecutionHistoryEntry[] | undefined,
  ) {
    if (!executions?.length) {
      return;
    }

    this.taskExecutionsByScopedId.set(
      this.buildScopedTaskKey(instanceId, taskId),
      executions.map((execution) => ({ ...execution })),
    );
  }

  private getRememberedTaskExecutions(taskId: string, instanceId?: string) {
    const resolvedInstanceId = this.resolveTaskInstanceId(taskId, instanceId);
    if (!resolvedInstanceId) {
      return [];
    }

    return (
      this.taskExecutionsByScopedId.get(this.buildScopedTaskKey(resolvedInstanceId, taskId)) || []
    ).map((execution) => ({ ...execution }));
  }

  private rememberTasks(
    instanceId: string,
    tasks: Task[],
    gatewayTaskIds: ReadonlySet<string> = new Set<string>(),
    fallbackExecutionsById: Record<string, TaskExecutionHistoryEntry[]> = {},
  ) {
    this.clearTasksForInstance(instanceId);
    tasks.forEach((task) => {
      const mode = gatewayTaskIds.has(task.id) ? 'gateway' : 'backend';
      this.taskRouteById.set(task.id, {
        instanceId,
        mode,
      });
      this.taskRouteByScopedId.set(this.buildScopedTaskKey(instanceId, task.id), mode);
      this.rememberTaskExecutions(instanceId, task.id, fallbackExecutionsById[task.id]);
    });
  }

  private forgetTask(id: string, instanceId?: string) {
    const resolvedInstanceId = this.resolveTaskInstanceId(id, instanceId);
    if (resolvedInstanceId) {
      const scopedTaskKey = this.buildScopedTaskKey(resolvedInstanceId, id);
      this.taskRouteByScopedId.delete(scopedTaskKey);
      this.taskExecutionsByScopedId.delete(scopedTaskKey);
    }

    const rememberedRoute = this.taskRouteById.get(id);
    if (!rememberedRoute || !resolvedInstanceId || rememberedRoute.instanceId === resolvedInstanceId) {
      this.refreshFallbackTaskRoute(id);
    }
  }

  private resolveTaskInstanceId(taskId: string, instanceId?: string) {
    return instanceId || this.taskRouteById.get(taskId)?.instanceId;
  }

  private resolveTaskRoute(taskId: string, instanceId?: string) {
    if (instanceId) {
      const scopedMode = this.taskRouteByScopedId.get(this.buildScopedTaskKey(instanceId, taskId));
      if (scopedMode) {
        return {
          instanceId,
          mode: scopedMode,
        } satisfies TaskRoute;
      }
    }

    const rememberedRoute = this.taskRouteById.get(taskId);
    if (rememberedRoute) {
      return rememberedRoute;
    }

    const resolvedInstanceId = this.resolveTaskInstanceId(taskId, instanceId);
    if (!resolvedInstanceId) {
      return null;
    }

    return {
      instanceId: resolvedInstanceId,
      mode: 'backend',
    } satisfies TaskRoute;
  }

  private async getTaskWorkbenchDetail(
    instanceId: string,
  ): Promise<StudioInstanceDetailRecord | null> {
    const detail = await studio.getInstanceDetail(instanceId);
    return canManageTasks(detail) ? detail : null;
  }

  private async requireTaskWorkbenchDetail(instanceId: string) {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    if (!detail) {
      throw new Error(TASK_MANAGEMENT_UNAVAILABLE_ERROR);
    }

    return detail;
  }

  private async getWorkbenchTask(instanceId: string, id: string) {
    const tasks = await this.getTasks(instanceId);
    return tasks.find((task) => task.id === id) || null;
  }

  private requireResolvedInstanceId(taskId: string, instanceId?: string) {
    const resolvedInstanceId = this.resolveTaskInstanceId(taskId, instanceId);
    if (!resolvedInstanceId) {
      throw new Error(TASK_INSTANCE_CONTEXT_UNAVAILABLE_ERROR);
    }

    return resolvedInstanceId;
  }

  private collectWorkbenchTaskExecutions(
    tasks: StudioWorkbenchTaskRecord[],
    executionsById: Record<string, StudioWorkbenchTaskExecutionRecord[]>,
  ) {
    const fallbackExecutionsById: Record<string, TaskExecutionHistoryEntry[]> = {};

    tasks.forEach((task) => {
      const normalizedTask = mapStudioTask(task);
      const rawTaskId = normalizeId(task.id);
      const executionCandidates = [
        normalizedTask.id,
        rawTaskId,
      ].filter((taskId): taskId is string => Boolean(taskId));

      const executions = executionCandidates.flatMap(
        (taskId) => executionsById[taskId] || [],
      );

      if (executions.length > 0) {
        fallbackExecutionsById[normalizedTask.id] = executions.map(mapStudioTaskExecution);
      }
    });

    return fallbackExecutionsById;
  }

  private collectLatestGatewayExecutions(tasks: StudioWorkbenchTaskRecord[]) {
    const fallbackExecutionsById: Record<string, TaskExecutionHistoryEntry[]> = {};

    tasks.forEach((task) => {
      if (task.latestExecution) {
        fallbackExecutionsById[task.id] = [mapStudioTaskExecution(task.latestExecution)];
      }
    });

    return fallbackExecutionsById;
  }

  async getList(instanceId: string, params: ListParams = {}): Promise<PaginatedResult<Task>> {
    const tasks = await this.getTasks(instanceId);

    let filtered = tasks;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter((task) => task.name.toLowerCase().includes(lowerKeyword));
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(instanceId: string, id: string): Promise<Task | null> {
    const tasks = await this.getTasks(instanceId);
    return tasks.find((task) => task.id === id) || null;
  }

  async create(instanceId: string, data: CreateTaskDTO): Promise<Task> {
    return this.createTask(instanceId, data);
  }

  async update(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task> {
    return this.updateTask(id, data, instanceId);
  }

  async delete(id: string, instanceId?: string): Promise<boolean> {
    await this.deleteTask(id, instanceId);
    return true;
  }

  async getTasks(instanceId: string): Promise<Task[]> {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    const taskCrudSurface = resolveTaskCrudSurface(detail);
    if (taskCrudSurface === 'unsupported') {
      this.clearTasksForInstance(instanceId);
      return [];
    }

    if (taskCrudSurface === 'backendWorkbench') {
      const workbench = detail?.workbench;
      if (!workbench) {
        this.clearTasksForInstance(instanceId);
        return [];
      }

      const backendTasks = normalizeUniqueById(workbench.cronTasks.tasks.map(mapStudioTask));
      const backendExecutionsById = this.collectWorkbenchTaskExecutions(
        workbench.cronTasks.tasks,
        workbench.cronTasks.taskExecutionsById,
      );
      this.rememberTasks(instanceId, backendTasks, new Set<string>(), backendExecutionsById);
      return backendTasks.map(cloneTaskRecord);
    }

    const gatewayWorkbenchTasks = await openClawGatewayClient.listWorkbenchCronJobs(instanceId);
    const gatewayTasks = normalizeUniqueById(gatewayWorkbenchTasks.map(mapStudioTask));
    const tasks = mergeTaskCollections([], gatewayTasks);
    this.rememberTasks(
      instanceId,
      tasks,
      new Set(gatewayTasks.map((task) => task.id)),
      this.collectLatestGatewayExecutions(gatewayWorkbenchTasks),
    );
    return tasks.map(cloneTaskRecord);
  }

  async createTask(instanceId: string, task: Omit<Task, 'id'>): Promise<Task> {
    const detail = await this.requireTaskWorkbenchDetail(instanceId);
    if (resolveTaskCrudSurface(detail) === 'gateway') {
      const createdJob = await openClawGatewayClient.addCronJob(
        instanceId,
        buildOpenClawCronTaskPayload(task) as never,
      );
      const tasks = await this.getTasks(instanceId);
      const created =
        tasks.find((candidate) => candidate.id === createdJob.id) ||
        tasks.find((candidate) => candidate.name === task.name && candidate.prompt === task.prompt) ||
        tasks[0];
      if (!created) {
        throw new Error('Failed to create task');
      }

      return created;
    }

    await studio.createInstanceTask(instanceId, buildOpenClawCronTaskPayload(task));
    const tasks = await this.getTasks(instanceId);
    const created =
      tasks.find((candidate) => candidate.name === task.name && candidate.prompt === task.prompt) ||
      tasks[0];
    if (!created) {
      throw new Error('Failed to create task');
    }

    return created;
  }

  async updateTask(id: string, data: UpdateTaskDTO, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const current = await this.getWorkbenchTask(resolvedInstanceId, id);
    if (!current) {
      throw new Error('Failed to update task');
    }
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    if (!route) {
      throw new Error('Failed to resolve the task route.');
    }

    const nextPayload = buildOpenClawCronTaskPayload(
      toCreateTaskInput(current, data),
      current.rawDefinition,
    );
    if (route.mode === 'gateway') {
      await openClawGatewayClient.updateCronJob(resolvedInstanceId, id, nextPayload as never);
    } else {
      await studio.updateInstanceTask(resolvedInstanceId, id, nextPayload);
    }
    const refreshed = await this.getWorkbenchTask(resolvedInstanceId, id);
    if (!refreshed) {
      throw new Error('Failed to update task');
    }
    return refreshed;
  }

  async cloneTask(id: string, overrides: UpdateTaskDTO = {}, instanceId?: string): Promise<Task> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    const current = await this.getWorkbenchTask(resolvedInstanceId, id);
    if (!current) {
      throw new Error('Failed to clone task');
    }
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    if (!route) {
      throw new Error('Failed to resolve the task route.');
    }

    if (route.mode === 'gateway') {
      return this.createTask(resolvedInstanceId, toCreateTaskInput(current, overrides));
    }

    await studio.cloneInstanceTask(resolvedInstanceId, id, overrides.name);
    const tasks = await this.getTasks(resolvedInstanceId);
    const cloned = tasks.find((candidate) => candidate.name === overrides.name) || tasks[0];
    if (!cloned) {
      throw new Error('Failed to clone task');
    }
    return cloned;
  }

  async runTaskNow(id: string, instanceId?: string): Promise<TaskExecutionHistoryEntry> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    if (route?.mode === 'gateway') {
      await openClawGatewayClient.runCronJob(resolvedInstanceId, id);
      try {
        const executions = await openClawGatewayClient.listWorkbenchCronRuns(resolvedInstanceId, id);
        if (executions.length > 0) {
          const mappedExecutions = executions.map(mapStudioTaskExecution);
          this.rememberTaskExecutions(resolvedInstanceId, id, mappedExecutions);
          return { ...mappedExecutions[0]! };
        }
      } catch {
        const fallbackExecutions = this.getRememberedTaskExecutions(id, resolvedInstanceId);
        if (fallbackExecutions?.length) {
          return { ...fallbackExecutions[0]! };
        }
      }

      const queuedExecution: TaskExecutionHistoryEntry = {
        id: `${id}-${Date.now()}`,
        taskId: id,
        status: 'running',
        trigger: 'manual',
        startedAt: new Date().toISOString(),
        summary: 'Cron job has been queued.',
      };
      const fallbackExecutions = this.getRememberedTaskExecutions(id, resolvedInstanceId);
      this.rememberTaskExecutions(resolvedInstanceId, id, [queuedExecution, ...fallbackExecutions]);
      return queuedExecution;
    }

    const execution = mapStudioTaskExecution(await studio.runInstanceTaskNow(resolvedInstanceId, id));
    const fallbackExecutions = this.getRememberedTaskExecutions(id, resolvedInstanceId);
    this.rememberTaskExecutions(resolvedInstanceId, id, [execution, ...fallbackExecutions]);
    return execution;
  }

  async listTaskExecutions(
    id: string,
    instanceId?: string,
  ): Promise<TaskExecutionHistoryEntry[]> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    if (route?.mode === 'gateway') {
      try {
        const executions = (await openClawGatewayClient.listWorkbenchCronRuns(resolvedInstanceId, id)).map(
          mapStudioTaskExecution,
        );
        this.rememberTaskExecutions(resolvedInstanceId, id, executions);
        return executions;
      } catch {
        try {
          const executions = (await studio.listInstanceTaskExecutions(resolvedInstanceId, id)).map(
            mapStudioTaskExecution,
          );
          this.rememberTaskExecutions(resolvedInstanceId, id, executions);
          return executions;
        } catch {
          return this.getRememberedTaskExecutions(id, resolvedInstanceId);
        }
      }
    }

    const executions = (await studio.listInstanceTaskExecutions(resolvedInstanceId, id)).map(
      mapStudioTaskExecution,
    );
    this.rememberTaskExecutions(resolvedInstanceId, id, executions);
    return executions;
  }

  async listDeliveryChannels(instanceId: string): Promise<TaskDeliveryChannelOption[]> {
    const detail = await this.getTaskWorkbenchDetail(instanceId);
    if (!detail) {
      return [];
    }

    const channels = detail.workbench?.channels ?? [];

    return normalizeUniqueById(
      channels
        .filter((channel) => channel.enabled && channel.status === 'connected')
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        })),
    );
  }

  async updateTaskStatus(
    id: string,
    status: Extract<TaskStatus, 'active' | 'paused'>,
    instanceId?: string,
  ): Promise<void> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    if (route?.mode === 'gateway') {
      await openClawGatewayClient.updateCronJob(resolvedInstanceId, id, {
        enabled: status === 'active',
      });
      return;
    }

    await studio.updateInstanceTaskStatus(resolvedInstanceId, id, status);
  }

  async deleteTask(id: string, instanceId?: string): Promise<void> {
    const resolvedInstanceId = this.requireResolvedInstanceId(id, instanceId);
    await this.requireTaskWorkbenchDetail(resolvedInstanceId);
    const route = this.resolveTaskRoute(id, resolvedInstanceId);
    const deleted = route?.mode === 'gateway'
      ? await openClawGatewayClient.removeCronJob(resolvedInstanceId, id)
      : await studio.deleteInstanceTask(resolvedInstanceId, id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
    this.forgetTask(id, resolvedInstanceId);
  }
}

export const taskService = new TaskService();
