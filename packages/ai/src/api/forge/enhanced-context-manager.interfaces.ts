import type { MessageImportance } from './enhanced-context-manager.types';

export interface ContextFrame {
  messageId: string;
  role: 'system' | 'user' | 'assistant';
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
export interface ContextSummary {
  periodStart: number;
  periodEnd: number;
  messageCount: number;
  keyDecisions: string[];
  completedTasks: string[];
  errors: { tool: string; message: string }[];
  systemState: Record<string, any>;
}
