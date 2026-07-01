import { lazy } from 'react';

const ChatPage = lazy(() =>
  import('./pages/Chat').then((module) => ({
    default: module.Chat,
  })),
);

export function Chat() {
  return <ChatPage />;
}
