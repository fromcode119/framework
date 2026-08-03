import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';

export interface IAssistantCheckpoint {
  resumePrompt?: string;
  reason?: CheckpointReason;
  stage?: RuntimeStage;
  planningPassesUsed?: number;
  memory?: {
    listing?: {
      collectionSlug: string;
      lastSelectedRowIndex?: number;
      lastSelectedRecordId?: string;
      lastSelectedField?: string;
    };
  };
}
