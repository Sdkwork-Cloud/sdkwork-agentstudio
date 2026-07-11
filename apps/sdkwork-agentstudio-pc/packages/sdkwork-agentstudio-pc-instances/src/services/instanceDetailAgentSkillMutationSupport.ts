import type { BuildOpenClawAgentSkillMutationHandlersArgs } from './openClawAgentSkillMutationSupport.ts';

type AgentSkillMutationExecutors = Pick<
  BuildOpenClawAgentSkillMutationHandlersArgs,
  'executeInstall' | 'executeToggle' | 'executeRemove'
>;

export interface InstanceDetailAgentSkillMutationService {
  installSkill: AgentSkillMutationExecutors['executeInstall'];
  setSkillEnabled: AgentSkillMutationExecutors['executeToggle'];
  removeSkill: AgentSkillMutationExecutors['executeRemove'];
}

export function createInstanceDetailAgentSkillMutationExecutors(args: {
  agentSkillManagementService: InstanceDetailAgentSkillMutationService;
}): AgentSkillMutationExecutors {
  return {
    executeInstall: (input) => args.agentSkillManagementService.installSkill(input),
    executeToggle: (input) => args.agentSkillManagementService.setSkillEnabled(input),
    executeRemove: (input) => args.agentSkillManagementService.removeSkill(input),
  };
}
