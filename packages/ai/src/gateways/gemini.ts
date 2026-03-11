import { UrlUtils } from '@fromcode119/sdk';
import { AssistantClient } from '../types.interfaces';
import type { GeminiConfig } from './gemini.types';

export class GeminiGateway {
  static normalizeGeminiConfig(input: Record<string, any>): GeminiConfig {
      return {
        apiKey: String(input?.apiKey || '').trim(),
        model: String(input?.model || 'gemini-1.5-pro').trim() || 'gemini-1.5-pro',
        baseUrl:
          UrlUtils.trimTrailingSlash(String(input?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').trim() ||
          'https://generativelanguage.googleapis.com/v1beta'),
        temperature: Number.isFinite(Number(input?.temperature)) ? Number(input?.temperature) : 0.2,
        maxTokens: Number.isFinite(Number(input?.maxTokens)) ? Number(input?.maxTokens) : 1200,
      };

  }

  static createGeminiClient(input: Record<string, any>): AssistantClient {
      const config = GeminiGateway.normalizeGeminiConfig(input);
      if (!config.apiKey) {
        throw new Error('Gemini API key is required for AI Assistant integration.');
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

            const contents = allMessages
              .filter((message: any) => String(message?.role || '').toLowerCase() !== 'system')
              .map((message: any) => ({
                role: String(message?.role || '').toLowerCase() === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(message?.content || '') }],
              }));

            const response = await fetch(
              `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...(systemPrompt
                    ? {
                        systemInstruction: {
                          parts: [{ text: systemPrompt }],
                        },
                      }
                    : {}),
                  contents,
                  generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                  },
                }),
                signal: controller.signal,
              },
            );

            const payload = await response.json().catch(() => ({} as any));
            if (!response.ok) {
              const message = String(payload?.error?.message || payload?.message || response.statusText || 'Gemini request failed');
              throw new Error(message);
            }

            const content = Array.isArray(payload?.candidates)
              ? payload.candidates
                  .flatMap((candidate: any) => {
                    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
                    return parts.map((part: any) => String(part?.text || '').trim()).filter(Boolean);
                  })
                  .filter(Boolean)
                  .join('\n')
              : '';

            return {
              content,
              model: config.model,
              usage: payload?.usageMetadata,
              raw: payload,
            };
          } finally {
            clearTimeout(timeout);
          }
        },
      };

  }
}

