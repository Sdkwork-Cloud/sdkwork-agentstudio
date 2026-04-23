import type { ChatPageAgentCatalogMode } from './chatPageContracts';

export function shouldLoadChatSkills({
  isRouteSupported = true,
  isSessionContextDrawerOpen,
  selectedSkillId,
}: {
  isRouteSupported?: boolean;
  isSessionContextDrawerOpen: boolean;
  selectedSkillId: string | null;
}) {
  if (!isRouteSupported) {
    return false;
  }

  return isSessionContextDrawerOpen || Boolean(selectedSkillId);
}

export function shouldLoadChatDirectAgents({
  activeInstanceId,
  isRouteSupported = true,
  agentCatalogMode,
  isSessionContextDrawerOpen,
  selectedAgentId,
}: {
  activeInstanceId: string | null | undefined;
  isRouteSupported?: boolean;
  agentCatalogMode: ChatPageAgentCatalogMode;
  isSessionContextDrawerOpen: boolean;
  selectedAgentId: string | null | undefined;
}) {
  if (!isRouteSupported || agentCatalogMode !== 'sharedCatalog' || !activeInstanceId) {
    return false;
  }

  return true;
}
