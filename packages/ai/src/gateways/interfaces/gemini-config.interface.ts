// ─── Companion types file for gemini.ts ─────────────────────────────────────

export interface IGeminiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}
