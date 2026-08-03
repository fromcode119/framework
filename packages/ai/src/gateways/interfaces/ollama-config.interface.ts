// ─── Companion types file for ollama.ts ─────────────────────────────────────

export interface IOllamaConfig {
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}
