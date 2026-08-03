import { CapabilityTier } from '@ai/api/forge/enums/capability-tier.enum';

import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export interface IAssistantChatParams {
  messages: IAssistantMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** EU AI Act: the feature invoking the model (e.g. 'mlm.retention_insight') — recorded for the audit log. */
  purpose?: string;
  /** EU AI Act risk classification for this call. Default 'limited' (AI interacting with a natural person). */
  riskTier?: CapabilityTier;
}
