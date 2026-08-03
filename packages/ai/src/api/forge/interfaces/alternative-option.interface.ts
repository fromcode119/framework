import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';

export interface IAlternativeOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  riskLevel: ComplexityTier;
  confidence: number;
}
