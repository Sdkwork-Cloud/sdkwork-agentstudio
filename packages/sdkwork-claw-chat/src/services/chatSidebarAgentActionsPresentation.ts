export type ChatSidebarAgentActionId = 'publish' | 'settings' | 'remove';

export interface ChatSidebarAgentActionRequest {
  actionId: ChatSidebarAgentActionId;
  instanceId: string;
  agentId: string;
  agentName: string;
  kernelId?: string | null;
  kernelLabel?: string | null;
}

export interface ChatSidebarAgentActionItemPresentation {
  id: ChatSidebarAgentActionId;
  label: string;
  disabled?: boolean;
  tone: 'default' | 'danger';
}

export interface ChatSidebarAgentActionSectionPresentation {
  id: 'primary' | 'danger';
  items: ChatSidebarAgentActionItemPresentation[];
}

export interface ChatSidebarAgentActionsPresentation {
  sections: ChatSidebarAgentActionSectionPresentation[];
}

export function resolveChatSidebarAgentActionsPresentation(params: {
  canRemove?: boolean;
  labels: {
    publish: string;
    settings: string;
    remove: string;
  };
}): ChatSidebarAgentActionsPresentation {
  const sections: ChatSidebarAgentActionSectionPresentation[] = [
    {
      id: 'primary',
      items: [
        {
          id: 'publish',
          label: params.labels.publish,
          tone: 'default',
        },
        {
          id: 'settings',
          label: params.labels.settings,
          tone: 'default',
        },
      ],
    },
  ];

  if (params.canRemove !== false) {
    sections.push({
      id: 'danger',
      items: [
        {
          id: 'remove',
          label: params.labels.remove,
          tone: 'danger',
        },
      ],
    });
  }

  return {
    sections,
  };
}
