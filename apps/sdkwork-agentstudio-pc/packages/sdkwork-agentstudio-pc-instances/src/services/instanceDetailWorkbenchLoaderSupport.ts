import type { StartLoadInstanceDetailAgentWorkbenchInput } from './instanceDetailAgentWorkbenchState.ts';
import type {
  StartLazyLoadInstanceWorkbenchFilesInput,
  StartLazyLoadInstanceWorkbenchMemoryInput,
} from './instanceWorkbenchHydration.ts';

type AgentWorkbenchLoader = StartLoadInstanceDetailAgentWorkbenchInput['loadAgentWorkbench'];
type WorkbenchFilesLoader = StartLazyLoadInstanceWorkbenchFilesInput['loadFiles'];
type WorkbenchMemoriesLoader = StartLazyLoadInstanceWorkbenchMemoryInput['loadMemories'];

export interface InstanceDetailWorkbenchLoaderBindings {
  loadAgentWorkbench: AgentWorkbenchLoader;
  loadFiles: WorkbenchFilesLoader;
  loadMemories: WorkbenchMemoriesLoader;
}

export function createInstanceDetailWorkbenchLoaderBindings(args: {
  agentWorkbenchService: {
    getAgentWorkbench: AgentWorkbenchLoader;
  };
  instanceWorkbenchService: {
    listInstanceFiles: WorkbenchFilesLoader;
    listInstanceMemories: WorkbenchMemoriesLoader;
  };
}): InstanceDetailWorkbenchLoaderBindings {
  return {
    loadAgentWorkbench: (input) => args.agentWorkbenchService.getAgentWorkbench(input),
    loadFiles: (instanceId, agents) => args.instanceWorkbenchService.listInstanceFiles(instanceId, agents),
    loadMemories: (instanceId, agents) => args.instanceWorkbenchService.listInstanceMemories(instanceId, agents),
  };
}
