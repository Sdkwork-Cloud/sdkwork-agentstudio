import type { ChatSession } from './useChatStore';

const INSTANCE_SCOPED_STUDIO_CONVERSATION_ERROR =
  'Instance-scoped kernel chat sessions are not persisted through the studio conversation store.';

export async function listInstanceConversations(_instanceId: string): Promise<ChatSession[]> {
  return [];
}

export async function putInstanceConversation(_session: ChatSession): Promise<ChatSession> {
  throw new Error(INSTANCE_SCOPED_STUDIO_CONVERSATION_ERROR);
}

export async function getInstanceConversation(
  _instanceId: string,
  _id: string,
  session: ChatSession,
): Promise<ChatSession> {
  return session;
}

export async function deleteInstanceConversation(_id: string, _instanceId?: string) {
  return true;
}

export async function resetInstanceConversation(session: ChatSession): Promise<ChatSession> {
  return {
    ...session,
    messages: [],
    lastMessagePreview: undefined,
  };
}
