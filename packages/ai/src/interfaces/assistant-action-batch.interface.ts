import { BatchState } from '@ai/components/enums/batch-state.enum';

export interface IAssistantActionBatch {
  id: string;
  state: BatchState;
  createdAt: number;
}
