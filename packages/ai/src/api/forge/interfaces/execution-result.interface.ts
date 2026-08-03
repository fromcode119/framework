export interface IExecutionResult {
  success: boolean;
  subtaskId: string;
  output?: Record<string, any>;
  error?: string;
  duration: number;
}
