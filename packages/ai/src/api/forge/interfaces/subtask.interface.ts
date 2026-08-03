import type { TaskStatus } from '@ai/api/forge/enums/task-status.enum';

export interface ISubtask {
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
