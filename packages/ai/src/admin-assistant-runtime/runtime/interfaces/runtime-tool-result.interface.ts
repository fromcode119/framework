export interface IRuntimeToolResult {
  tool: string;
  input: Record<string, any>;
  ok: boolean;
  output?: any;
  error?: string;
}
