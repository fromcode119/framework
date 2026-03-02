import { Logger } from '@fromcode119/sdk';
import { AssistantClient } from './types';

const logger = new Logger({ namespace: 'ai-openai' });

export type OpenAiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  organization?: string;
  project?: string;
  temperature: number;
  maxTokens: number;
};

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export function normalizeOpenAiConfig(input: Record<string, any>): OpenAiConfig {
  return {
    apiKey: String(input?.apiKey || '').trim(),
    model: String(input?.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini',
    baseUrl: trimSlash(String(input?.baseUrl || 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1'),
    organization: String(input?.organization || '').trim() || undefined,
    project: String(input?.project || '').trim() || undefined,
    temperature: Number.isFinite(Number(input?.temperature)) ? Number(input?.temperature) : 0.2,
    maxTokens: Number.isFinite(Number(input?.maxTokens)) ? Number(input?.maxTokens) : 1200,
  };
}

export function resolveOpenAiFromEnv() {
  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase() || 'openai';
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  if (provider !== 'openai') {
    logger.warn(`AI provider "${provider}" is not implemented. Falling back to "openai".`);
  }

  return {
    provider: 'openai',
    config: {
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      organization: process.env.OPENAI_ORGANIZATION || '',
      project: process.env.OPENAI_PROJECT || '',
      temperature: process.env.OPENAI_TEMPERATURE || '0.2',
      maxTokens: process.env.OPENAI_MAX_TOKENS || '1200',
    },
  };
}

export function createOpenAiClient(input: Record<string, any>): AssistantClient {
  const config = normalizeOpenAiConfig(input);
  if (!config.apiKey) {
    throw new Error('OpenAI API key is required for AI Assistant integration.');
  }

  return {
    async chat(params) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const temperature = Number.isFinite(Number(params?.temperature))
          ? Number(params.temperature)
          : config.temperature;
        const maxTokens = Number.isFinite(Number(params?.maxTokens))
          ? Number(params.maxTokens)
          : config.maxTokens;

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            ...(config.organization ? { 'OpenAI-Organization': config.organization } : {}),
            ...(config.project ? { 'OpenAI-Project': config.project } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: params.messages || [],
            temperature,
            max_tokens: maxTokens,
            ...(params.json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = String(payload?.error?.message || payload?.message || response.statusText || 'AI provider request failed');
          throw new Error(message);
        }

        const content = String(payload?.choices?.[0]?.message?.content || '').trim();
        return {
          content,
          model: String(payload?.model || config.model),
          usage: payload?.usage,
          raw: payload,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
