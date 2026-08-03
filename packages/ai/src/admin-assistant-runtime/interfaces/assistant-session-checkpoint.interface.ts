import { RuntimeStage } from '@ai/admin-assistant-runtime/runtime/enums/runtime-stage.enum';
import { CheckpointReason } from '@ai/admin-assistant-runtime/enums/checkpoint-reason.enum';
import type { IAssistantSessionEntityMemory } from '@ai/admin-assistant-runtime/interfaces/assistant-session-entity-memory.interface';

export interface IAssistantSessionCheckpoint {
  resumePrompt: string;
  reason: CheckpointReason;
  stage?: RuntimeStage;
  planningPassesUsed?: number;
  memory?: IAssistantSessionEntityMemory;
}
