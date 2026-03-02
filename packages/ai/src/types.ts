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

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  actions?: AssistantAction[];
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
};

export type IntegrationFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

export type IntegrationConfigField = {
  name: string;
  label: string;
  type: IntegrationFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type IntegrationProviderDefinition = {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
};

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
