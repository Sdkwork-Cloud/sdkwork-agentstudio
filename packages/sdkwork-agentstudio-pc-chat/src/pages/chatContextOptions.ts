import type { Agent, Skill } from '@sdkwork/agentstudio-pc-types';
import { resolveChatAgentDisplayIdentity } from '../services';

export interface ChatContextOption {
  id: string | null;
  name: string;
  description: string;
  avatarLabel: string | null;
}

type ChatAgentOptionSource = Agent & {
  kernelLabel?: string | null;
};

export function buildChatAgentOptions(params: {
  agents: ChatAgentOptionSource[];
  defaultLabel: string;
  defaultDescription: string;
}) {
  return [
    {
      id: null,
      name: params.defaultLabel,
      description: params.defaultDescription,
      avatarLabel: null,
    },
    ...params.agents.map((agent) => {
      const identity = resolveChatAgentDisplayIdentity({
        agentId: agent.id,
        agentLabel: agent.name,
        avatarLabel: agent.avatar,
        kernelLabel: agent.kernelLabel,
      });

      return {
        id: agent.id,
        name: identity.name,
        description: agent.description ?? '',
        avatarLabel: identity.avatarLabel,
      };
    }),
  ] satisfies ChatContextOption[];
}

export function buildChatSkillOptions(params: {
  skills: Skill[];
  defaultLabel: string;
  defaultDescription: string;
}) {
  return [
    {
      id: null,
      name: params.defaultLabel,
      description: params.defaultDescription,
      avatarLabel: null,
    },
    ...params.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description ?? '',
      avatarLabel: skill.name.slice(0, 2).toUpperCase(),
    })),
  ] satisfies ChatContextOption[];
}
