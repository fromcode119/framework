import type { IThinkingSegment } from '@ai/api/forge/interfaces/thinking-segment.interface';

export interface IThinkingStream {
  sessionId: string;
  startTime: number;
  segments: IThinkingSegment[];
  isComplete: boolean;
  totalDurationMs?: number;
  phaseProgress: {
    planning: number; // 0-100
    analysis: number;
    decision: number;
    action: number;
    verification: number;
  };
}
