import { useQuery } from '@tanstack/react-query';
import { clawHubService } from '@sdkwork/agentstudio-pc-core';
import type { Skill } from '@sdkwork/agentstudio-pc-types';
import { shouldLoadChatSkills } from './chatHydrationPolicy';

const EMPTY_SKILLS: Skill[] = [];

export interface UseChatSkillCatalogStateInput {
  activeInstanceId: string | null | undefined;
  isChatSupportedRoute: boolean;
  isSessionContextDrawerOpen: boolean;
  selectedSkillId: string | null;
}

export interface UseChatSkillCatalogStateResult {
  visibleSkills: Skill[];
  isSkillSelectorLoading: boolean;
}

export function useChatSkillCatalogState({
  activeInstanceId: _activeInstanceId,
  isChatSupportedRoute,
  isSessionContextDrawerOpen,
  selectedSkillId,
}: UseChatSkillCatalogStateInput): UseChatSkillCatalogStateResult {
  const shouldLoadSkillCatalog = shouldLoadChatSkills({
    isRouteSupported: isChatSupportedRoute,
    isSessionContextDrawerOpen,
    selectedSkillId,
  });
  const {
    data: skills = EMPTY_SKILLS,
    isFetching: isSkillsFetching,
  } = useQuery<Skill[]>({
    queryKey: ['skills'],
    enabled: shouldLoadSkillCatalog,
    staleTime: 30_000,
    queryFn: () => clawHubService.listSkills(),
  });
  const visibleSkills = isChatSupportedRoute ? skills : EMPTY_SKILLS;
  const isSkillSelectorLoading =
    isSessionContextDrawerOpen &&
    shouldLoadSkillCatalog &&
    isSkillsFetching &&
    visibleSkills.length === 0;

  return {
    visibleSkills,
    isSkillSelectorLoading,
  };
}
