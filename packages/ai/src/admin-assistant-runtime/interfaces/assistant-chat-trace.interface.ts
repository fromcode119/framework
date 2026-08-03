import { AgentRole } from '@ai/api/forge/enums/agent-role.enum';

export interface IAssistantChatTrace {
  iteration: number;
  message: string;
  phase?: AgentRole;
  toolCalls: Array<{ tool: string; input: Record<string, any> }>;
}
