import { useTranslation } from 'react-i18next';
import { ChatConversationPane } from '../components/ChatConversationPane';
import { ChatSidebarChrome } from '../components/ChatSidebarChrome';
import { ChatSessionContextDrawer } from '../components/ChatSessionContextDrawer';
import { useChatPageCompositionState } from './useChatPageCompositionState';

export function Chat() {
  const { t, i18n } = useTranslation();
  const {
    sidebarChromeProps,
    conversationPaneProps,
    sessionContextDrawerProps,
  } = useChatPageCompositionState({
    t,
    language: i18n.language,
  });

  return (
    <div className="relative flex h-full min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <ChatSidebarChrome {...sidebarChromeProps} />
      <ChatConversationPane {...conversationPaneProps} />
      <ChatSessionContextDrawer {...sessionContextDrawerProps} />
    </div>
  );
}
