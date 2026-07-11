import { studio } from '@sdkwork/agentstudio-pc-infrastructure';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';
import type { ChatSession } from '../store/useChatStore';
import type { StudioConversationRecord } from '@sdkwork/agentstudio-pc-types';

function isMissingStudioConversationPutMethodError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('putConversation is not a function');
}

async function repairPersistedConversationTitleIfNeeded(
  record: StudioConversationRecord,
  session: ChatSession,
) {
  try {
    const repairedRecord = mapChatSession(session);
    if (repairedRecord.title === record.title) {
      return session;
    }

    return mapStudioConversation(await studio.putConversation(repairedRecord));
  } catch (error) {
    if (isMissingStudioConversationPutMethodError(error)) {
      return session;
    }

    console.error('Failed to repair persisted conversation title:', error);
    return session;
  }
}

class StudioConversationService {
  async listConversations(instanceId: string) {
    const records = await studio.listConversations(instanceId);
    const sessions = records.map(mapStudioConversation);
    return Promise.all(
      sessions.map((session, index) =>
        repairPersistedConversationTitleIfNeeded(records[index]!, session),
      ),
    );
  }

  async putConversation(session: ChatSession) {
    const record = await studio.putConversation(mapChatSession(session));
    return mapStudioConversation(record);
  }

  async deleteConversation(id: string) {
    return studio.deleteConversation(id);
  }
}

export const studioConversationService = new StudioConversationService();
