import { TaskProgress } from '@ai/api/forge/enums/task-progress.enum';

import type { ISubtask } from '@ai/api/forge/interfaces/subtask.interface';
import type { ICheckpoint } from '@ai/api/forge/interfaces/checkpoint.interface';
import type { ITaskDependency } from '@ai/api/forge/interfaces/task-dependency.interface';

export interface ITaskPlan {
  id: string;
  goalStatement: string;
  subtasks: ISubtask[];
  dependencies: ITaskDependency[];
  checkpoints: ICheckpoint[];
  createdAt: number;
  estimatedTotalDuration: number;
  actualTotalDuration?: number;
  status: TaskProgress | 'abandoned';
}
