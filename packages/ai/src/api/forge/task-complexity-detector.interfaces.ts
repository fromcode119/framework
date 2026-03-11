export interface TaskComplexity {
  level: 'simple' | 'moderate' | 'complex';
  reason: string;
  skipPlanning: boolean;
  estimatedIterations: number;
  confidence: number; // 0-1
}
