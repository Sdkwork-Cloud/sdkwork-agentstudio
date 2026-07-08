import type { ChatSidebarHistorySectionId } from './chatSidebarHistoryPresentation.ts';

export interface ChatSidebarChromeSectionPresentation<TSection> {
  section: TSection;
  titleKey: string;
}

export interface ChatSidebarChromePresentation<TSection> {
  sections: ChatSidebarChromeSectionPresentation<TSection>[];
  showAgentRail: boolean;
  showEmptyState: boolean;
}

const sectionTitleKeyById: Record<ChatSidebarHistorySectionId, string> = {
  today: 'chat.sidebar.today',
  previous7Days: 'chat.sidebar.previous7Days',
  older: 'chat.sidebar.older',
};

export function resolveChatSidebarChromePresentation<
  TSection extends { id: ChatSidebarHistorySectionId },
>(params: {
  agentRailItemCount: number;
  historySections: TSection[];
  totalHistoryItems: number;
}): ChatSidebarChromePresentation<TSection> {
  return {
    sections: params.historySections.map((section) => ({
      section,
      titleKey: sectionTitleKeyById[section.id],
    })),
    showAgentRail: params.agentRailItemCount > 0,
    showEmptyState: params.totalHistoryItems === 0,
  };
}
