// ─── Companion types file for openai.ts ─────────────────────────────────────

export type OpenAiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  organization?: string;
  project?: string;
  temperature: number;
  maxTokens: number;
};
