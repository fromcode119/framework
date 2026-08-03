// ─── Companion types file for openai.ts ─────────────────────────────────────

export interface IOpenAiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  organization?: string;
  project?: string;
  temperature: number;
  maxTokens: number;
}
