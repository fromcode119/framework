import type { McpToolDefinition } from '@fromcode119/mcp';

export type AssistantCollectionContext = {
  slug: string;
  shortSlug: string;
  label: string;
  pluginSlug: string;
  raw?: any;
};

export type AssistantPluginContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
  capabilities?: string[];
  path?: string;
};

export type AssistantThemeContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
  path?: string;
};

export type AssistantAction = {
  type: 'create_content' | 'update_setting' | 'mcp_call';
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantToolMetadata = {
  category?: string;
  entity?: string;
  intentHints?: string[];
  filters?: string[];
  returns?: string[];
  examples?: string[];
  followupHints?: string[];
};

export type AssistantToolSummary = Pick<McpToolDefinition, 'tool' | 'description' | 'readOnly'> & {
  metadata?: AssistantToolMetadata;
};
