export type ChatSidebarSessionPinOrigin = 'none' | 'user' | 'system';

export type ChatSidebarSessionActionId = 'favorite' | 'pin' | 'delete';

export interface ChatSidebarSessionActionItemPresentation {
  id: ChatSidebarSessionActionId;
  label: string;
  disabled?: boolean;
  tone: 'default' | 'danger';
}

export interface ChatSidebarSessionActionSectionPresentation {
  id: 'primary' | 'danger';
  items: ChatSidebarSessionActionItemPresentation[];
}

export interface ChatSidebarSessionActionsPresentation {
  sections: ChatSidebarSessionActionSectionPresentation[];
}

export function resolveChatSidebarSessionActionsPresentation(params: {
  isFavorited: boolean;
  pinOrigin: ChatSidebarSessionPinOrigin;
  canDelete: boolean;
  labels: {
    favorite: string;
    unfavorite: string;
    pin: string;
    unpin: string;
    delete: string;
  };
}): ChatSidebarSessionActionsPresentation {
  const sections: ChatSidebarSessionActionSectionPresentation[] = [
    {
      id: 'primary',
      items: [
        {
          id: 'favorite',
          label: params.isFavorited ? params.labels.unfavorite : params.labels.favorite,
          tone: 'default',
        },
        {
          id: 'pin',
          label: params.pinOrigin === 'none' ? params.labels.pin : params.labels.unpin,
          disabled: params.pinOrigin === 'system',
          tone: 'default',
        },
      ],
    },
  ];

  if (params.canDelete) {
    sections.push({
      id: 'danger',
      items: [
        {
          id: 'delete',
          label: params.labels.delete,
          tone: 'danger',
        },
      ],
    });
  }

  return {
    sections,
  };
}
