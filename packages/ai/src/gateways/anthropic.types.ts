// ─── Companion types file for anthropic.ts ──────────────────────────────────

export type AnthropicConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  anthropicVersion: string;
  temperature: number;
  maxTokens: number;
};
