import type { AssistantActionBatch, AssistantAction, ConversationMode } from '../admin-assistant-core';

export interface AssistantActionCardProps {
  batch?: AssistantActionBatch;
  actions: AssistantAction[];
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
