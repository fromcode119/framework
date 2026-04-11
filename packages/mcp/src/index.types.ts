/** Type definitions for McpBridgeFactory */

export type McpCall = {
  tool: string;
  input?: Record<string, any>;
  context?: Record<string, any>;
};

export type McpResult = {
  ok: boolean;
  output?: any;
  error?: string;
};

export type McpToolDefinition = {
  tool: string;
  description?: string;
  readOnly?: boolean;
  metadata?: Record<string, unknown>;
  handler: (input?: Record<string, any>, context?: Record<string, any>) => Promise<any> | any;
};

export type McpBridgeOptions = {
  tools?: McpToolDefinition[];
};
