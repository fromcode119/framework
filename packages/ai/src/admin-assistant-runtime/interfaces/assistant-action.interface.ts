import { AssistantActionType } from '@ai/admin-assistant-runtime/enums/assistant-action-type.enum';

export interface IAssistantAction {
  type: AssistantActionType;
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
}
