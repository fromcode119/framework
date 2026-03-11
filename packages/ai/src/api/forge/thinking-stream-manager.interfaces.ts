export interface ThinkingSegment {
  id: string;
  timestamp: number;
  phase: 'planning' | 'analysis' | 'decision' | 'action' | 'verification';
  content: string;
  metadata?: {
    confidence?: number;
    alternatives?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
  };
}
export interface ThinkingStream {
  sessionId: string;
  startTime: number;
  segments: ThinkingSegment[];
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
