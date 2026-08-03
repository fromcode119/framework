import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';

import type { IErrorRecovery } from '@ai/api/forge/interfaces/error-recovery.interface';

export interface IReasoningReport {
  totalSteps: number;
  successfulSteps: number;
  recoveries: IErrorRecovery[];
  averageConfidence: number;
  totalDuration: number;
  keyDecisions: string[];
  riskAssessment: ComplexityTier;
}
