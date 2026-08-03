import { SegmentPhase } from '@ai/api/forge/enums/segment-phase.enum';
import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';

export interface IThinkingSegment {
  id: string;
  timestamp: number;
  phase: SegmentPhase;
  content: string;
  metadata?: {
    confidence?: number;
    alternatives?: string[];
    riskLevel?: ComplexityTier;
  };
}
