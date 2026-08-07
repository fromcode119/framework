import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';
import type { IAssistantPlanArtifact } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-artifact.interface';
import type { IAssistantUiHints } from '@ai/interfaces/assistant-ui-hints.interface';
import type { IAssistantSkill } from '@ai/interfaces/assistant-skill.interface';
import type { IAssistantCheckpoint } from '@ai/interfaces/assistant-checkpoint.interface';
import type { IAssistantActionBatch } from '@ai/interfaces/assistant-action-batch.interface';
import type { IAssistantTrace } from '@ai/interfaces/assistant-trace.interface';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';
import { AssistantRole } from '@ai/enums/assistant-role.enum';

/** One entry in the assistant conversation — the user turn or the assistant turn plus everything
 * the runtime attached to it (actions, traces, plan, checkpoint). */
export interface IAssistantMessage {
  role: AssistantRole;
  content: string;
  attachments?: IUploadedAttachment[];
  actions?: IAssistantAction[];
  actionBatch?: IAssistantActionBatch;
  traces?: IAssistantTrace[];
  plan?: IAssistantPlanArtifact;
  ui?: IAssistantUiHints;
  skill?: IAssistantSkill;
  sessionId?: string;
  checkpoint?: IAssistantCheckpoint;
  done?: boolean;
  iterations?: number;
  loopCapReached?: boolean;
  model?: string;
  provider?: string;
  reasoningReport?: string;
  execution?: any;
}
