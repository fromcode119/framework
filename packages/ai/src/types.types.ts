import type { AssistantMessage } from './types.interfaces';

export type AssistantRole = 'system' | 'user' | 'assistant';

export type AssistantAction = {
  type: string;
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantTrace = {
  iteration: number;
  message?: string;
  toolCalls?: Array<{ tool?: string; input?: Record<string, any> }>;
};

export type AssistantSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

export type AssistantToolOption = {
  tool: string;
  description?: string;
  readOnly?: boolean;
  metadata?: Record<string, unknown>;
};

