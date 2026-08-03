import { SpeedTier } from '@ai/api/forge/enums/speed-tier.enum';
import { CostTier } from '@ai/api/forge/enums/cost-tier.enum';

export interface ITaskContext {
  taskDescription: string;
  goal: string;
  availableContext: Record<string, any>;
  previousResults?: Record<string, any>;
  constraints?: {
    maxCost?: CostTier;
    maxLatency?: SpeedTier;
    requireRetry?: boolean;
  };
}
