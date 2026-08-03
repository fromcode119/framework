import { BatchState } from '@ai/components/enums/batch-state.enum';

export interface IAssistantExecuteResult {
  success: boolean;
  dryRun: boolean;
  results: any[];
  executedBatchId?: string;
  batchState?: BatchState;
  executionSummary?: { ok: number; unchanged: number; failed: number };
}
