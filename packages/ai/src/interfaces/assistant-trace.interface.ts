export interface IAssistantTrace {
  iteration: number;
  message?: string;
  toolCalls?: Array<{ tool?: string; input?: Record<string, any> }>;
}
