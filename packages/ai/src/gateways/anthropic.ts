import { UrlUtils } from '@fromcode119/core/client';
import { AssistantClient } from '../types.interfaces';
import type { AnthropicConfig } from './anthropic.types';

export class AnthropicGateway {
  static normalizeAnthropicConfig(input: Record<string, any>): AnthropicConfig {
      return {
        apiKey: String(input?.apiKey || '').trim(),
        model: String(input?.model || 'claude-3-5-sonnet-latest').trim() || 'claude-3-5-sonnet-latest',
        baseUrl: UrlUtils.trimTrailingSlash(String(input?.baseUrl || 'https://api.anthropic.com').trim() || 'https://api.anthropic.com'),
        anthropicVersion: String(input?.anthropicVersion || '2023-06-01').trim() || '2023-06-01',
        temperature: Number.isFinite(Number(input?.temperature)) ? Number(input?.temperature) : 0.2,
        maxTokens: Number.isFinite(Number(input?.maxTokens)) ? Number(input?.maxTokens) : 1200,
      };

  }

  static createAnthropicClient(input: Record<string, any>): AssistantClient {
      const config = AnthropicGateway.normalizeAnthropicConfig(input);
      if (!config.apiKey) {
        throw new Error('Anthropic API key is required for AI Assistant integration.');
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

            const allMessages = Array.isArray(params?.messages) ? params.messages : [];
            const systemPrompt = allMessages
              .filter((message: any) => String(message?.role || '').toLowerCase() === 'system')
              .map((message: any) => String(message?.content || '').trim())
              .filter(Boolean)
              .join('\n\n');

            const messages = allMessages
              .filter((message: any) => String(message?.role || '').toLowerCase() !== 'system')
              .map((message: any) => ({
                role: String(message?.role || '').toLowerCase() === 'assistant' ? 'assistant' : 'user',
                content: [{ type: 'text', text: String(message?.content || '') }],
              }));

            const response = await fetch(`${config.baseUrl}/v1/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': config.anthropicVersion,
              },
              body: JSON.stringify({
                model: config.model,
                system: systemPrompt || undefined,
                messages,
                temperature,
                max_tokens: maxTokens,
              }),
              signal: controller.signal,
            });

            const payload = await response.json().catch(() => ({} as any));
            if (!response.ok) {
              const message = String(payload?.error?.message || payload?.message || response.statusText || 'Anthropic request failed');
              throw new Error(message);
            }

            const content = Array.isArray(payload?.content)
              ? payload.content
                  .map((item: any) => String(item?.text || '').trim())
                  .filter(Boolean)
                  .join('\n')
              : String(payload?.content || '').trim();

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
}

