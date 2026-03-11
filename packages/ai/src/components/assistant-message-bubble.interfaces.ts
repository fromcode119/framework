export interface AssistantMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  status?: 'sending' | 'sent' | 'error';
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
}
