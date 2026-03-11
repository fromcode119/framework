import type { AssistantRole, AssistantAction, AssistantTrace } from './types.types';

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  actions?: AssistantAction[];
  actionBatch?: {
    id: string;
    state: 'staged' | 'previewed' | 'applied' | 'stale';
    createdAt: number;
  };
  model?: string;
  provider?: string;
  iterations?: number;
  loopCapReached?: boolean;
  traces?: AssistantTrace[];
  execution?: {
    dryRun?: boolean;
    results?: any[];
  };
}

export interface AssistantChatParams {
  messages: AssistantMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AssistantChatResponse {
  content: string;
  model: string;
  usage?: any;
  raw?: any;
}

export interface AssistantClient {
  chat: (params: AssistantChatParams) => Promise<AssistantChatResponse>;
}

