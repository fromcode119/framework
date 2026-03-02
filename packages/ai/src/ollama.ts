import { AssistantClient } from './types';

export type OllamaConfig = {
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
};

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export function normalizeOllamaConfig(input: Record<string, any>): OllamaConfig {
  return {
    model: String(input?.model || 'llama3.1').trim() || 'llama3.1',
    baseUrl: trimSlash(String(input?.baseUrl || 'http://127.0.0.1:11434').trim() || 'http://127.0.0.1:11434'),
    temperature: Number.isFinite(Number(input?.temperature)) ? Number(input?.temperature) : 0.2,
    maxTokens: Number.isFinite(Number(input?.maxTokens)) ? Number(input?.maxTokens) : 1200,
  };
}

export function createOllamaClient(input: Record<string, any>): AssistantClient {
  const config = normalizeOllamaConfig(input);

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

        const response = await fetch(`${config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: params.messages || [],
            stream: false,
            options: {
              temperature,
              num_predict: maxTokens,
            },
            ...(params.json ? { format: 'json' } : {}),
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = String(payload?.error || payload?.message || response.statusText || 'Ollama request failed');
          throw new Error(message);
        }

        const content = String(payload?.message?.content || '').trim();
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
