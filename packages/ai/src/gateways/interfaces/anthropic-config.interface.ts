// ─── Companion types file for anthropic.ts ──────────────────────────────────

export interface IAnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  anthropicVersion: string;
  temperature: number;
  maxTokens: number;
}
