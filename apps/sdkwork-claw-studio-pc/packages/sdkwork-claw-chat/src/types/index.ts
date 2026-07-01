import type { StudioConversationAttachment } from '@sdkwork/claw-types';

export interface ChatMessageData {
  id: string;
  sender: 'user' | 'provider';
  text: string;
  time: string;
  attachments?: StudioConversationAttachment[];
}

export type ClawChatMessage = ChatMessageData;
export type ChatAttachment = StudioConversationAttachment;

export interface ChatComposerSubmitPayload {
  text: string;
  attachments: StudioConversationAttachment[];
}

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  icon: string;
}
