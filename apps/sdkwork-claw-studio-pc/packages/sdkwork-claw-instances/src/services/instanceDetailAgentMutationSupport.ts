import type { OpenClawAgentInput } from '@sdkwork/claw-core';
import type { CreateOpenClawAgentMutationRunnerArgs } from './openClawAgentMutationSupport.ts';

type AgentMutationExecutors = Pick<
  CreateOpenClawAgentMutationRunnerArgs<OpenClawAgentInput>,
  'executeCreate' | 'executeUpdate' | 'executeDelete'
>;

export interface InstanceDetailAgentMutationService {
  createOpenClawAgent: AgentMutationExecutors['executeCreate'];
  updateOpenClawAgent: AgentMutationExecutors['executeUpdate'];
  deleteOpenClawAgent: AgentMutationExecutors['executeDelete'];
}

export function createInstanceDetailAgentMutationExecutors(args: {
  instanceService: InstanceDetailAgentMutationService;
}): AgentMutationExecutors {
  return {
    executeCreate: (instanceId, agent) => args.instanceService.createOpenClawAgent(instanceId, agent),
    executeUpdate: (instanceId, agent) => args.instanceService.updateOpenClawAgent(instanceId, agent),
    executeDelete: (instanceId, agentId) =>
      args.instanceService.deleteOpenClawAgent(instanceId, agentId),
  };
}
