import { createOllamaClient, normalizeOllamaConfig } from './ollama';
import { createOpenAiClient, normalizeOpenAiConfig } from './openai';
import { resolveAiFromEnv as resolveAiProviderFromEnv } from './env';
import type { AssistantClient } from './types';

type IntegrationConfigFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

type IntegrationConfigField = {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

type IntegrationProviderDefinition<TInstance = any> = {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: any }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
};

type IntegrationTypeDefinition<TInstance = any> = {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
};

function resolveAiFromEnv() {
  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase() || 'openai';
  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      config: {
        model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.1',
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.AI_BASE_URL || 'http://127.0.0.1:11434',
        temperature: process.env.OLLAMA_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2',
        maxTokens: process.env.OLLAMA_MAX_TOKENS || process.env.AI_MAX_TOKENS || '1200',
      },
    };
  }

  return resolveAiProviderFromEnv();
}

export const AiIntegrationDefinition: IntegrationTypeDefinition<AssistantClient> = {
  key: 'ai',
  label: 'AI Assistant',
  description: 'LLM provider used by admin automation and AI-assisted content operations.',
  defaultProvider: 'openai',
  resolveFromEnv: resolveAiFromEnv,
  providers: [
    {
      key: 'openai',
      label: 'OpenAI',
      description: 'Use OpenAI Chat Completions API for assistant planning and actions.',
      fields: [
        {
          name: 'apiKey',
          label: 'API Key',
          type: 'password',
          required: true,
          placeholder: 'sk-...',
        },
        {
          name: 'model',
          label: 'Model',
          type: 'text',
          placeholder: 'gpt-4o-mini',
        },
        {
          name: 'baseUrl',
          label: 'Base URL',
          type: 'text',
          placeholder: 'https://api.openai.com/v1',
        },
        {
          name: 'organization',
          label: 'Organization ID',
          type: 'text',
          placeholder: 'org_...',
        },
        {
          name: 'project',
          label: 'Project ID',
          type: 'text',
          placeholder: 'proj_...',
        },
        {
          name: 'temperature',
          label: 'Temperature',
          type: 'number',
          placeholder: '0.2',
        },
        {
          name: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          placeholder: '1200',
        },
      ],
      normalizeConfig: normalizeOpenAiConfig as any,
      create: (config) => createOpenAiClient(config),
    },
    {
      key: 'ollama',
      label: 'Ollama',
      description: 'Use a local Ollama server for assistant planning and actions.',
      fields: [
        {
          name: 'model',
          label: 'Model',
          type: 'text',
          required: true,
          placeholder: 'llama3.1',
        },
        {
          name: 'baseUrl',
          label: 'Base URL',
          type: 'text',
          required: true,
          placeholder: 'http://127.0.0.1:11434',
        },
        {
          name: 'temperature',
          label: 'Temperature',
          type: 'number',
          placeholder: '0.2',
        },
        {
          name: 'maxTokens',
          label: 'Max Tokens',
          type: 'number',
          placeholder: '1200',
        },
      ],
      normalizeConfig: normalizeOllamaConfig as any,
      create: (config) => createOllamaClient(config),
    },
  ],
};
