// ─── Companion types file for model-router.ts ───────────────────────────────

export type RuntimeGenerationProfile = {
  temperature: number;
  maxTokens: number;
  strategy: 'cheap_discovery' | 'balanced_chat' | 'high_reasoning' | 'deterministic';
};
