import type { Agent, ListParams, PaginatedResult } from '@sdkwork/claw-types';
import { kernelChatAgentCatalogService } from './kernelChatAgentCatalogService.ts';

export interface CreateAgentDTO {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  creator: string;
}

export interface UpdateAgentDTO extends Partial<CreateAgentDTO> {}

export interface IAgentService {
  getList(params?: ListParams, instanceId?: string): Promise<PaginatedResult<Agent>>;
  getById(id: string, instanceId?: string): Promise<Agent | null>;
  create(data: CreateAgentDTO): Promise<Agent>;
  update(id: string, data: UpdateAgentDTO): Promise<Agent>;
  delete(id: string): Promise<boolean>;
  getAgents(instanceId?: string): Promise<Agent[]>;
  getAgent(id: string, instanceId?: string): Promise<Agent>;
}

function paginateAgents(agents: Agent[], params: ListParams = {}): PaginatedResult<Agent> {
  let filteredAgents = [...agents];

  if (params.keyword) {
    const lowerKeyword = params.keyword.toLowerCase();
    filteredAgents = filteredAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(lowerKeyword) ||
        agent.description.toLowerCase().includes(lowerKeyword),
    );
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const total = filteredAgents.length;
  const start = (page - 1) * pageSize;

  return {
    items: filteredAgents.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

class AgentService implements IAgentService {
  async getList(params: ListParams = {}, instanceId?: string): Promise<PaginatedResult<Agent>> {
    return paginateAgents(await this.getAgents(instanceId), params);
  }

  async getById(id: string, instanceId?: string): Promise<Agent | null> {
    try {
      return await this.getAgent(id, instanceId);
    } catch {
      return null;
    }
  }

  async create(_data: CreateAgentDTO): Promise<Agent> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateAgentDTO): Promise<Agent> {
    throw new Error('Method not implemented.');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getAgents(instanceId?: string): Promise<Agent[]> {
    return kernelChatAgentCatalogService.listAgents(instanceId);
  }

  async getAgent(id: string, instanceId?: string): Promise<Agent> {
    const agents = await this.getAgents(instanceId);
    const agent = agents.find((candidate) => candidate.id === id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent;
  }
}

export const agentService = new AgentService();
