import type { TaskStatus } from './planning-engine.types';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  requiredTools: string[];
  expectedOutput: string;
  status: TaskStatus;
  parentTaskId?: string;
  priority: number; // 1-10, higher = more important
  estimatedDuration?: number; // milliseconds
  actualDuration?: number;
  result?: Record<string, any>;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}
export interface Checkpoint {
  id: string;
  title: string;
  afterSubtaskId: string;
  verificationCriteria: string;
  verificationScript?: string;
  savedState: Record<string, any>;
  timestamp: number;
  verified: boolean;
}
export interface TaskDependency {
  from: string; // subtask ID that must complete first
  to: string; // subtask ID that depends on 'from'
  reason: string;
}
export interface TaskPlan {
  id: string;
  goalStatement: string;
  subtasks: Subtask[];
  dependencies: TaskDependency[];
  checkpoints: Checkpoint[];
  createdAt: number;
  estimatedTotalDuration: number;
  actualTotalDuration?: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'failed' | 'abandoned';
}
export interface ExecutionResult {
  success: boolean;
  subtaskId: string;
  output?: Record<string, any>;
  error?: string;
  duration: number;
}
