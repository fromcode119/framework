import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantChatTrace } from '@ai/admin-assistant-runtime/interfaces/assistant-chat-trace.interface';
import type { IAssistantPlanArtifact } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-artifact.interface';
import type { IAssistantUiHints } from '@ai/admin-assistant-runtime/interfaces/assistant-ui-hints.interface';
import type { IAssistantSkillDefinition } from '@ai/admin-assistant-runtime/interfaces/assistant-skill-definition.interface';
import type { IAssistantActionBatch } from '@ai/admin-assistant-runtime/interfaces/assistant-action-batch.interface';
import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';

export interface IAssistantChatResult {
  message: string;
  actions: IAssistantAction[];
  model: string;
  agentMode: ContextLevel;
  done: boolean;
  traces: IAssistantChatTrace[];
  plan?: IAssistantPlanArtifact;
  ui?: IAssistantUiHints;
  actionBatch?: IAssistantActionBatch;
  skill?: IAssistantSkillDefinition;
  sessionId?: string;
  checkpoint?: IAssistantSessionCheckpoint;
  iterations?: number;
  loopCapReached?: boolean;
}
