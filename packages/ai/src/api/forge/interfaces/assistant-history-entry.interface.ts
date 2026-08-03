import { AssistantRole } from '@ai/enums/assistant-role.enum';
// ─── Companion types file for request-payload-service.ts ────────────────────

export interface IAssistantHistoryEntry { 
    role: AssistantRole; 
    content: string 
}
