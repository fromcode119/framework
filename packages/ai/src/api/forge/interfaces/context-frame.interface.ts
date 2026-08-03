import { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { MessageImportance } from '@ai/api/forge/enums/message-importance.enum';

export interface IContextFrame {
  messageId: string;
  role: AssistantRole;
  content: string;
  importance: MessageImportance;
  tokens: number; // Estimated token count
  timestamp: number;
  isCheckpointSummary?: boolean;
  metadata?: {
    toolsUsed?: string[];
    errorRecovery?: boolean;
    decision?: string;
    taskId?: string;
  };
}
