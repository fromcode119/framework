import { TaskComplexity } from '@ai/api/forge/enums/task-complexity.enum';

export interface ITaskComplexityAssessment {
  level: TaskComplexity;
  reason: string;
  skipPlanning: boolean;
  estimatedIterations: number;
  confidence: number; // 0-1
}
