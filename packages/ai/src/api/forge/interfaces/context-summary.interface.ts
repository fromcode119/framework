export interface IContextSummary {
  periodStart: number;
  periodEnd: number;
  messageCount: number;
  keyDecisions: string[];
  completedTasks: string[];
  errors: { tool: string; message: string }[];
  systemState: Record<string, any>;
}
