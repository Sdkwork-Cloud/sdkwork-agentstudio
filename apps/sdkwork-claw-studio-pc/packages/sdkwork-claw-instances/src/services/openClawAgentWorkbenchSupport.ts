import type { OpenClawConfigSnapshot } from '@sdkwork/claw-core';
import type { Agent, Skill } from '@sdkwork/claw-types';
import type { InstanceWorkbenchAgent, InstanceWorkbenchTask } from '../types/index.ts';
import { normalizeOpenClawAgentId } from './openClawSupport.ts';

type OpenClawAgentConfigSnapshot = OpenClawConfigSnapshot['agentSnapshots'][number];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function deriveFocusAreas(agent: Agent, skills: Skill[]) {
  const source = `${agent.name} ${agent.description} ${agent.systemPrompt}`.toLowerCase();
  const focusAreas = new Set<string>();

  if (source.includes('code') || source.includes('software') || source.includes('debug')) {
    focusAreas.add('Code');
  }
  if (source.includes('data') || source.includes('analysis')) {
    focusAreas.add('Analytics');
  }
  if (source.includes('operat') || source.includes('workflow') || source.includes('incident')) {
    focusAreas.add('Operations');
  }
  if (source.includes('creative') || source.includes('story') || source.includes('content')) {
    focusAreas.add('Content');
  }

  skills.slice(0, 2).forEach((skill) => focusAreas.add(skill.category));

  if (focusAreas.size === 0) {
    focusAreas.add('Generalist');
  }

  return [...focusAreas].slice(0, 4);
}

export function mapAgent(
  agent: Agent,
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
): InstanceWorkbenchAgent {
  const focusAreas = deriveFocusAreas(agent, skills);
  const automationFitScore = clampScore(
    focusAreas.length * 15 + tasks.filter((task) => task.status === 'active').length * 12,
  );

  return {
    agent,
    focusAreas,
    automationFitScore,
    configSource: 'runtime',
  };
}

function mapConfigBackedAgent(
  agentSnapshot: OpenClawAgentConfigSnapshot,
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
  runtimeRecord?: InstanceWorkbenchAgent,
): InstanceWorkbenchAgent {
  const normalizedAgentId = normalizeOpenClawAgentId(agentSnapshot.id);
  const agentProfile = {
    id: normalizedAgentId,
    name: agentSnapshot.name,
    description: agentSnapshot.description,
    avatar: agentSnapshot.avatar,
    systemPrompt: runtimeRecord?.agent.systemPrompt || '',
    creator: runtimeRecord?.agent.creator || 'OpenClaw',
  };
  const focusAreas =
    runtimeRecord?.focusAreas && runtimeRecord.focusAreas.length > 0
      ? [...runtimeRecord.focusAreas]
      : deriveFocusAreas(agentProfile, skills);
  const automationFitScore =
    runtimeRecord?.automationFitScore ??
    clampScore(focusAreas.length * 15 + tasks.filter((task) => task.status === 'active').length * 12);

  return {
    agent: agentProfile,
    focusAreas,
    automationFitScore,
    workspace: agentSnapshot.workspace,
    agentDir: agentSnapshot.agentDir,
    isDefault: agentSnapshot.isDefault,
    model: {
      primary: agentSnapshot.model.primary,
      fallbacks: [...agentSnapshot.model.fallbacks],
    },
    params: { ...agentSnapshot.params },
    paramSources: { ...agentSnapshot.paramSources },
    configSource: 'configFile',
  };
}

export function cloneWorkbenchAgent(agent: InstanceWorkbenchAgent): InstanceWorkbenchAgent {
  return {
    ...agent,
    agent: { ...agent.agent },
    focusAreas: [...agent.focusAreas],
    model: agent.model
      ? {
          primary: agent.model.primary,
          fallbacks: [...agent.model.fallbacks],
        }
      : undefined,
    params: agent.params ? { ...agent.params } : undefined,
    paramSources: agent.paramSources ? { ...agent.paramSources } : undefined,
  };
}

export function normalizeWorkbenchAgent(agent: InstanceWorkbenchAgent): InstanceWorkbenchAgent {
  return {
    ...cloneWorkbenchAgent(agent),
    agent: {
      ...agent.agent,
      id: normalizeOpenClawAgentId(agent.agent.id),
    },
  };
}

export function mergeWorkbenchAgents(
  baseAgent: InstanceWorkbenchAgent,
  overrideAgent: InstanceWorkbenchAgent,
): InstanceWorkbenchAgent {
  const normalizedBase = normalizeWorkbenchAgent(baseAgent);
  const normalizedOverride = normalizeWorkbenchAgent(overrideAgent);

  return {
    ...normalizedBase,
    ...normalizedOverride,
    agent: {
      ...normalizedBase.agent,
      ...normalizedOverride.agent,
      id: normalizedOverride.agent.id || normalizedBase.agent.id,
      name: normalizedOverride.agent.name || normalizedBase.agent.name,
      description: normalizedOverride.agent.description || normalizedBase.agent.description,
      avatar: normalizedOverride.agent.avatar || normalizedBase.agent.avatar,
      systemPrompt:
        normalizedOverride.agent.systemPrompt || normalizedBase.agent.systemPrompt,
      creator: normalizedOverride.agent.creator || normalizedBase.agent.creator,
    },
    focusAreas:
      normalizedOverride.focusAreas.length > 0
        ? [...normalizedOverride.focusAreas]
        : [...normalizedBase.focusAreas],
    automationFitScore:
      normalizedOverride.automationFitScore ?? normalizedBase.automationFitScore,
    model: normalizedOverride.model
      ? {
          primary: normalizedOverride.model.primary,
          fallbacks: [...normalizedOverride.model.fallbacks],
        }
      : normalizedBase.model
        ? {
            primary: normalizedBase.model.primary,
            fallbacks: [...normalizedBase.model.fallbacks],
          }
        : undefined,
    params: normalizedOverride.params
      ? { ...normalizedOverride.params }
      : normalizedBase.params
        ? { ...normalizedBase.params }
        : undefined,
    paramSources: normalizedOverride.paramSources
      ? { ...normalizedOverride.paramSources }
      : normalizedBase.paramSources
        ? { ...normalizedBase.paramSources }
        : undefined,
  };
}

export function mergeOpenClawAgentCollections(
  baseAgents: InstanceWorkbenchAgent[],
  overrideAgents: InstanceWorkbenchAgent[],
): InstanceWorkbenchAgent[] {
  const orderedIds: string[] = [];
  const mergedAgents = new Map<string, InstanceWorkbenchAgent>();
  const baseAgentsById = new Map<string, InstanceWorkbenchAgent>();

  baseAgents.forEach((agent) => {
    const normalizedAgent = normalizeWorkbenchAgent(agent);
    baseAgentsById.set(normalizedAgent.agent.id, normalizedAgent);
  });

  overrideAgents.forEach((agent) => {
    const normalizedAgent = normalizeWorkbenchAgent(agent);
    orderedIds.push(normalizedAgent.agent.id);
    mergedAgents.set(
      normalizedAgent.agent.id,
      baseAgentsById.has(normalizedAgent.agent.id)
        ? mergeWorkbenchAgents(baseAgentsById.get(normalizedAgent.agent.id)!, normalizedAgent)
        : normalizedAgent,
    );
  });

  baseAgentsById.forEach((agent, agentId) => {
    if (!mergedAgents.has(agentId)) {
      orderedIds.push(agentId);
      mergedAgents.set(agentId, agent);
    }
  });

  return orderedIds
    .map((agentId) => mergedAgents.get(agentId))
    .filter(Boolean)
    .map((agent) => cloneWorkbenchAgent(agent!));
}

export function buildOpenClawWorkbenchAgents(
  agentSnapshots: OpenClawAgentConfigSnapshot[],
  runtimeAgents: InstanceWorkbenchAgent[],
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
): InstanceWorkbenchAgent[] {
  const runtimeAgentsById = new Map(
    runtimeAgents.map((agent) => {
      const normalizedAgent = normalizeWorkbenchAgent(agent);
      return [normalizedAgent.agent.id, normalizedAgent] as const;
    }),
  );
  const configBackedAgents = agentSnapshots.map((agentSnapshot) =>
    mapConfigBackedAgent(
      agentSnapshot,
      tasks,
      skills,
      runtimeAgentsById.get(normalizeOpenClawAgentId(agentSnapshot.id)),
    ),
  );
  const configBackedAgentIds = new Set(configBackedAgents.map((agent) => agent.agent.id));

  return [
    ...configBackedAgents,
    ...runtimeAgents
      .filter((agent) => !configBackedAgentIds.has(normalizeOpenClawAgentId(agent.agent.id)))
      .map(cloneWorkbenchAgent),
  ];
}
