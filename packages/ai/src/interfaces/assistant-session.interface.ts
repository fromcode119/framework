
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export interface IAssistantSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: IAssistantMessage[];
}
