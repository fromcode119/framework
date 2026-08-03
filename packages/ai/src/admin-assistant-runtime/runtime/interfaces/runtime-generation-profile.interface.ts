import { ModelStrategy } from '@ai/admin-assistant-runtime/enums/model-strategy.enum';
// ─── Companion types file for model-router.ts ───────────────────────────────

export interface IRuntimeGenerationProfile {
  temperature: number;
  maxTokens: number;
  strategy: ModelStrategy;
}
