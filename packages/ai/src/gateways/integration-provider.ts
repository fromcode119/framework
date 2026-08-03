import { IntegrationConfigFieldType } from '@fromcode119/core/client';
import { ModelQuality } from '@ai/admin-assistant-runtime/enums/model-quality.enum';
import { OllamaGateway } from '@ai/gateways/ollama';
import { OpenAiGateway } from '@ai/gateways/openai';
import { AnthropicGateway } from '@ai/gateways/anthropic';
import { GeminiGateway } from '@ai/gateways/gemini';
import { AiActComplianceWrapper } from '@ai/gateways/ai-act-compliance-wrapper';
import type { IAssistantClient } from '@ai/interfaces/assistant-client.interface';
import type { IProviderCapabilities } from '@ai/admin-assistant-runtime/interfaces/provider-capabilities.interface';
import type { IIntegrationTypeDefinition } from '@ai/gateways/interfaces/integration-type-definition.interface';

export class ProviderCapabilitiesUtils {

    static resolveAiFromEnv() {
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
    if (provider === 'anthropic') {
      const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
      if (!apiKey) return null;
      return {
        provider: 'anthropic',
        config: {
          apiKey,
          model: process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || 'claude-3-5-sonnet-latest',
          baseUrl: process.env.ANTHROPIC_BASE_URL || process.env.AI_BASE_URL || 'https://api.anthropic.com',
          temperature: process.env.ANTHROPIC_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2',
          maxTokens: process.env.ANTHROPIC_MAX_TOKENS || process.env.AI_MAX_TOKENS || '1200',
        },
      };
    }
    if (provider === 'gemini') {
      const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey) return null;
      return {
        provider: 'gemini',
        config: {
          apiKey,
          model: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-1.5-pro',
          baseUrl: process.env.GEMINI_BASE_URL || process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
          temperature: process.env.GEMINI_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2',
          maxTokens: process.env.GEMINI_MAX_TOKENS || process.env.AI_MAX_TOKENS || '1200',
        },
      };
    }
    return OpenAiGateway.resolveOpenAiFromEnv();
  }

  static resolveProviderCapabilities(provider: string): IProviderCapabilities {
      const key = String(provider || '').trim().toLowerCase();
      return (
        ProviderCapabilitiesUtils.CAPABILITIES[key] || {
          supportsJsonMode: false,
          supportsToolCallSchema: false,
          maxContextTokens: 32000,
          qualityTier: 'standard',
        }
      );

  }

  static readonly CAPABILITIES: Record<string, IProviderCapabilities> = {
    openai: {
      supportsJsonMode: true,
      supportsToolCallSchema: true,
      maxContextTokens: 128000,
      qualityTier: ModelQuality.HIGH,
    },
    anthropic: {
      supportsJsonMode: false,
      supportsToolCallSchema: false,
      maxContextTokens: 200000,
      qualityTier: ModelQuality.HIGH,
    },
    gemini: {
      supportsJsonMode: false,
      supportsToolCallSchema: false,
      maxContextTokens: 1000000,
      qualityTier: ModelQuality.HIGH,
    },
    ollama: {
      supportsJsonMode: true,
      supportsToolCallSchema: false,
      maxContextTokens: 32000,
      qualityTier: ModelQuality.LOCAL,
    },
  };

  static readonly aiIntegration: IIntegrationTypeDefinition<IAssistantClient> = {
    key: 'ai',
    label: 'AI Assistant',
    description: 'LLM provider used by admin automation and AI-assisted content operations.',
    defaultProvider: 'openai',
    resolveFromEnv: ProviderCapabilitiesUtils.resolveAiFromEnv,
    providers: [
      {
        key: 'openai',
        label: 'OpenAI',
        description: 'Use OpenAI Chat Completions API for assistant planning and actions.',
        fields: [
          { name: 'apiKey', label: 'API Key', type: IntegrationConfigFieldType.PASSWORD, required: true, placeholder: 'sk-...' },
          { name: 'model', label: 'Model', type: IntegrationConfigFieldType.TEXT, placeholder: 'gpt-4o-mini' },
          { name: 'baseUrl', label: 'Base URL', type: IntegrationConfigFieldType.TEXT, placeholder: 'https://api.openai.com/v1' },
          { name: 'organization', label: 'Organization ID', type: IntegrationConfigFieldType.TEXT, placeholder: 'org_...' },
          { name: 'project', label: 'Project ID', type: IntegrationConfigFieldType.TEXT, placeholder: 'proj_...' },
          { name: 'temperature', label: 'Temperature', type: IntegrationConfigFieldType.NUMBER, placeholder: '0.2' },
          { name: 'maxTokens', label: 'Max Tokens', type: IntegrationConfigFieldType.NUMBER, placeholder: '1200' },
        ],
        normalizeConfig: OpenAiGateway.normalizeOpenAiConfig as any,
        create: (config) => AiActComplianceWrapper.wrap(OpenAiGateway.createOpenAiClient(config), 'openai'),
      },
      {
        key: 'ollama',
        label: 'Ollama',
        description: 'Use a local Ollama server for assistant planning and actions.',
        fields: [
          { name: 'model', label: 'Model', type: IntegrationConfigFieldType.TEXT, required: true, placeholder: 'llama3.1' },
          { name: 'baseUrl', label: 'Base URL', type: IntegrationConfigFieldType.TEXT, required: true, placeholder: 'http://host.docker.internal:11434' },
          { name: 'temperature', label: 'Temperature', type: IntegrationConfigFieldType.NUMBER, placeholder: '0.2' },
          { name: 'maxTokens', label: 'Max Tokens', type: IntegrationConfigFieldType.NUMBER, placeholder: '1200' },
        ],
        normalizeConfig: OllamaGateway.normalizeOllamaConfig as any,
        create: (config) => AiActComplianceWrapper.wrap(OllamaGateway.createOllamaClient(config), 'ollama'),
      },
      {
        key: 'anthropic',
        label: 'Anthropic',
        description: 'Use Anthropic Messages API for assistant planning and actions.',
        fields: [
          { name: 'apiKey', label: 'API Key', type: IntegrationConfigFieldType.PASSWORD, required: true, placeholder: 'sk-ant-...' },
          { name: 'model', label: 'Model', type: IntegrationConfigFieldType.TEXT, placeholder: 'claude-3-5-sonnet-latest' },
          { name: 'baseUrl', label: 'Base URL', type: IntegrationConfigFieldType.TEXT, placeholder: 'https://api.anthropic.com' },
          { name: 'anthropicVersion', label: 'API Version', type: IntegrationConfigFieldType.TEXT, placeholder: '2023-06-01' },
          { name: 'temperature', label: 'Temperature', type: IntegrationConfigFieldType.NUMBER, placeholder: '0.2' },
          { name: 'maxTokens', label: 'Max Tokens', type: IntegrationConfigFieldType.NUMBER, placeholder: '1200' },
        ],
        normalizeConfig: AnthropicGateway.normalizeAnthropicConfig as any,
        create: (config) => AiActComplianceWrapper.wrap(AnthropicGateway.createAnthropicClient(config), 'anthropic'),
      },
      {
        key: 'gemini',
        label: 'Gemini',
        description: 'Use Google Gemini API for assistant planning and actions.',
        fields: [
          { name: 'apiKey', label: 'API Key', type: IntegrationConfigFieldType.PASSWORD, required: true, placeholder: 'AIza...' },
          { name: 'model', label: 'Model', type: IntegrationConfigFieldType.TEXT, placeholder: 'gemini-1.5-pro' },
          { name: 'baseUrl', label: 'Base URL', type: IntegrationConfigFieldType.TEXT, placeholder: 'https://generativelanguage.googleapis.com/v1beta' },
          { name: 'temperature', label: 'Temperature', type: IntegrationConfigFieldType.NUMBER, placeholder: '0.2' },
          { name: 'maxTokens', label: 'Max Tokens', type: IntegrationConfigFieldType.NUMBER, placeholder: '1200' },
        ],
        normalizeConfig: GeminiGateway.normalizeGeminiConfig as any,
        create: (config) => AiActComplianceWrapper.wrap(GeminiGateway.createGeminiClient(config), 'gemini'),
      },
    ],
  };
}