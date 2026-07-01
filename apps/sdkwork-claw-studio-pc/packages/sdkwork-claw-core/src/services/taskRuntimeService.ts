import {
  openClawGatewayClient,
  studio,
  type OpenClawRuntimeTaskDetailRecord,
  type OpenClawRuntimeTaskRecord,
  type OpenClawTaskFlowDetailRecord,
  type OpenClawTaskFlowRecord,
} from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { supportsRuntimeTaskSurface } from './taskSurfaceSupport.ts';

export interface TaskRuntimeCollectionState<T> {
  supported: boolean;
  message: string | null;
  items: T[];
}

export interface TaskRuntimeOverview {
  runtimeTaskSurface: boolean;
  taskBoard: TaskRuntimeCollectionState<OpenClawRuntimeTaskRecord>;
  taskFlows: TaskRuntimeCollectionState<OpenClawTaskFlowRecord>;
}

export interface TaskRuntimeServiceOverrides {
  getInstanceDetail?: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  listRuntimeTasks?: (instanceId: string) => Promise<OpenClawRuntimeTaskRecord[]>;
  listTaskFlows?: (instanceId: string) => Promise<OpenClawTaskFlowRecord[]>;
  getRuntimeTaskDetail?: (
    instanceId: string,
    lookup: string,
  ) => Promise<OpenClawRuntimeTaskDetailRecord | null>;
  getTaskFlowDetail?: (
    instanceId: string,
    lookup: string,
  ) => Promise<OpenClawTaskFlowDetailRecord | null>;
}

interface TaskRuntimeServiceDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  listRuntimeTasks: (instanceId: string) => Promise<OpenClawRuntimeTaskRecord[]>;
  listTaskFlows: (instanceId: string) => Promise<OpenClawTaskFlowRecord[]>;
  getRuntimeTaskDetail: (
    instanceId: string,
    lookup: string,
  ) => Promise<OpenClawRuntimeTaskDetailRecord | null>;
  getTaskFlowDetail: (
    instanceId: string,
    lookup: string,
  ) => Promise<OpenClawTaskFlowDetailRecord | null>;
}

function createUnsupportedCollection<T>(message: string | null = null): TaskRuntimeCollectionState<T> {
  return {
    supported: false,
    message,
    items: [],
  };
}

function createDependencies(
  overrides: TaskRuntimeServiceOverrides = {},
): TaskRuntimeServiceDependencies {
  return {
    getInstanceDetail: overrides.getInstanceDetail ?? ((instanceId) => studio.getInstanceDetail(instanceId)),
    listRuntimeTasks: overrides.listRuntimeTasks ?? ((instanceId) => openClawGatewayClient.listRuntimeTasks(instanceId)),
    listTaskFlows: overrides.listTaskFlows ?? ((instanceId) => openClawGatewayClient.listTaskFlows(instanceId)),
    getRuntimeTaskDetail:
      overrides.getRuntimeTaskDetail ??
      ((instanceId, lookup) => openClawGatewayClient.getRuntimeTaskDetail(instanceId, lookup)),
    getTaskFlowDetail:
      overrides.getTaskFlowDetail ??
      ((instanceId, lookup) => openClawGatewayClient.getTaskFlowDetail(instanceId, lookup)),
  };
}

async function loadCollection<T>(
  loader: () => Promise<T[]>,
): Promise<TaskRuntimeCollectionState<T>> {
  try {
    return {
      supported: true,
      message: null,
      items: await loader(),
    };
  } catch (error) {
    return createUnsupportedCollection(
      error instanceof Error ? error.message : 'The runtime task surface is unavailable.',
    );
  }
}

export function createTaskRuntimeService(
  overrides: TaskRuntimeServiceOverrides = {},
) {
  const dependencies = createDependencies(overrides);

  async function getOverview(instanceId: string): Promise<TaskRuntimeOverview> {
    const detail = await dependencies.getInstanceDetail(instanceId);
    if (!supportsRuntimeTaskSurface(detail)) {
      return {
        runtimeTaskSurface: false,
        taskBoard: createUnsupportedCollection(),
        taskFlows: createUnsupportedCollection(),
      };
    }

    const [taskBoard, taskFlows] = await Promise.all([
      loadCollection(() => dependencies.listRuntimeTasks(instanceId)),
      loadCollection(() => dependencies.listTaskFlows(instanceId)),
    ]);

    return {
      runtimeTaskSurface: true,
      taskBoard,
      taskFlows,
    };
  }

  async function getTaskFlowDetail(
    instanceId: string,
    lookup: string,
  ): Promise<OpenClawTaskFlowDetailRecord | null> {
    const detail = await dependencies.getInstanceDetail(instanceId);
    if (!supportsRuntimeTaskSurface(detail)) {
      return null;
    }

    return dependencies.getTaskFlowDetail(instanceId, lookup);
  }

  async function getRuntimeTaskDetail(
    instanceId: string,
    lookup: string,
  ): Promise<OpenClawRuntimeTaskDetailRecord | null> {
    const detail = await dependencies.getInstanceDetail(instanceId);
    if (!supportsRuntimeTaskSurface(detail)) {
      return null;
    }

    return dependencies.getRuntimeTaskDetail(instanceId, lookup);
  }

  return {
    getOverview,
    getRuntimeTaskDetail,
    getTaskFlowDetail,
  };
}

export const taskRuntimeService = createTaskRuntimeService();
