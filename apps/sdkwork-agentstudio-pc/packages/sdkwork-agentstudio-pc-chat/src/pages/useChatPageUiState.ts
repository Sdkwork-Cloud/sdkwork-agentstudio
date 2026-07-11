import { useState } from 'react';
import type { ChatPageUiState } from './chatPageContracts';

export type UseChatPageUiStateResult = ChatPageUiState;

export function useChatPageUiState(): UseChatPageUiStateResult {
  const [isSessionContextDrawerOpen, setIsSessionContextDrawerOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null | undefined>(undefined);
  const [selectionTransition, setSelectionTransition] = useState<
    ChatPageUiState['selection']['selectionTransition']
  >(null);

  return {
    drawer: {
      isSessionContextDrawerOpen,
      setIsSessionContextDrawerOpen,
    },
    selection: {
      selectedSkillId,
      setSelectedSkillId,
      selectedAgentId,
      setSelectedAgentId,
      selectionTransition,
      setSelectionTransition,
    },
  };
}
