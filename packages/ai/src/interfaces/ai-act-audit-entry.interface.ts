import { CapabilityTier } from '@ai/api/forge/enums/capability-tier.enum';

/**
 * EU AI Act Art. 12 record-keeping entry — one row per model invocation. Prompt/response TEXT is never
 * included (privacy-preserving); only structural metrics + classification. Written to a framework-owned,
 * retained, queryable sink so an admin/regulator can review every income-adjacent AI interaction.
 */
export interface IAiActAuditEntry {
  provider: string;
  model: string;
  purpose: string;
  riskTier: CapabilityTier;
  ok: boolean;
  ms: number;
  promptChars: number;
  responseChars: number;
  error?: string;
}
