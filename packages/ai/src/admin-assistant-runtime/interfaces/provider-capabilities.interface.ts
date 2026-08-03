import { ModelQuality } from '@ai/admin-assistant-runtime/enums/model-quality.enum';

export interface IProviderCapabilities {
  supportsJsonMode: boolean;
  supportsToolCallSchema: boolean;
  maxContextTokens: number;
  qualityTier: ModelQuality;
}
