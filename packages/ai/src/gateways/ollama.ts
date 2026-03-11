import { UrlUtils } from '@fromcode119/sdk';
import { AssistantClient } from '../types.interfaces';
import type { OllamaConfig } from './ollama.types';

export class OllamaGateway {
  static normalizeOllamaConfig(input: Record<string, any>): OllamaConfig {
      return {
        model: String(input?.model || 'llama3.1').trim() || 'llama3.1',
        baseUrl: UrlUtils.trimTrailingSlash(String(input?.baseUrl || 'http://127.0.0.1:11434').trim() || 'http://127.0.0.1:11434'),
        temperature: Number.isFinite(Number(input?.temperature)) ? Number(input?.temperature) : 0.2,
        maxTokens: Number.isFinite(Number(input?.maxTokens)) ? Number(input?.maxTokens) : 1200,
      };

  }

  static createOllamaClient(input: Record<string, any>): AssistantClient {
      const config = OllamaGateway.normalizeOllamaConfig(input);
      const explicitBaseUrl = UrlUtils.trimTrailingSlash(String(input?.baseUrl || '').trim());
      const configuredHost = (() => {
        try {
          return String(new URL(config.baseUrl).hostname || '').trim().toLowerCase();
        } catch {
          return '';
        }
      })();
      const includeDockerFallback =
        !explicitBaseUrl || configuredHost === '127.0.0.1' || configuredHost === 'localhost' || configuredHost === '0.0.0.0';
      const baseCandidates = Array.from(
        new Set(
          [
            config.baseUrl,
            ...(includeDockerFallback ? ['http://host.docker.internal:11434'] : []),
          ]
            .map((item) => UrlUtils.trimTrailingSlash(String(item || '').trim()))
            .filter((item) => !!item),
        ),
      );

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

            let lastError = '';

            for (const baseUrl of baseCandidates) {
              try {
                const response = await fetch(`${baseUrl}/api/chat`, {
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
                  lastError = String(payload?.error || payload?.message || response.statusText || 'Ollama request failed');
                  continue;
                }

                const content = String(payload?.message?.content || '').trim();
                return {
                  content,
                  model: String(payload?.model || config.model),
                  usage: payload?.usage,
                  raw: payload,
                };
              } catch (error: any) {
                lastError = String(error?.message || 'Ollama request failed');
              }
            }

            throw new Error(lastError || 'Ollama request failed');
          } finally {
            clearTimeout(timeout);
          }
        },
      };

  }
}

