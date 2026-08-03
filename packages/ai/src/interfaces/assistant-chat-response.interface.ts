import { CapabilityTier } from '@ai/api/forge/enums/capability-tier.enum';

export interface IAssistantChatResponse {
  content: string;
  model: string;
  usage?: any;
  raw?: any;
  /** EU AI Act transparency metadata stamped by the compliance wrapper (disclosure + risk tier + log time). */
  aiAct?: {
    disclosure: string;
    riskTier: CapabilityTier;
    loggedAt: string;
  };
}
