import type { IAssistantChatParams } from '@ai/interfaces/assistant-chat-params.interface';
import type { IAssistantChatResponse } from '@ai/interfaces/assistant-chat-response.interface';

export interface IAssistantClient {
  chat: (params: IAssistantChatParams) => Promise<IAssistantChatResponse>;
}
