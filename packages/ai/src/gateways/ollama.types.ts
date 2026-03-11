// ─── Companion types file for ollama.ts ─────────────────────────────────────

export type OllamaConfig = {
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
};
