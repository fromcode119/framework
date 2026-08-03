import type { IAssistantActionBatch } from '@ai/interfaces/assistant-action-batch.interface';
import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';

export interface IAssistantActionCardProps {
  batch?: IAssistantActionBatch;
  actions: IAssistantAction[];
  selectedIndexes: number[];
  onToggleAction: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPreview: () => Promise<void>;
  onApply: () => Promise<void>;
  isRunning: boolean;
  executionSummary?: { ok: number; unchanged: number; failed: number };
  mode: ConversationMode;
  placement?: 'bottom';
  bottomOffset?: number;
}
