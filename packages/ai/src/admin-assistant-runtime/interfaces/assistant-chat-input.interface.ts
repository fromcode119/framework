import type { AssistantRole } from '@ai/enums/assistant-role.enum';

import type { IAssistantSessionCheckpoint } from '@ai/admin-assistant-runtime/interfaces/assistant-session-checkpoint.interface';

export interface IAssistantChatInput {
  message: string;
  provider?: string;
  history?: Array<{ role?: AssistantRole; content?: string }>;
  agentMode?: string;
  maxIterations?: number;
  maxDurationMs?: number;
  allowedTools?: string[];
  skillId?: string;
  sessionId?: string;
  continueFrom?: boolean;
  checkpoint?: IAssistantSessionCheckpoint;
}
