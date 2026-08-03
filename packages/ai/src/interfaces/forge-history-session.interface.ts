import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export interface IForgeHistorySession {
  id: string;
  title: string;
  updatedAt: number;
  provider: string;
  model: string;
  skillId?: string;
  chatMode: ChatMode;
  sandboxMode: boolean;
  messages: IAssistantMessage[];
  messageCount?: number;
}
