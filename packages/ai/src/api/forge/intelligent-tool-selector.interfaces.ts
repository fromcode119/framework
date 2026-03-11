import type { McpToolDefinition } from '@fromcode119/mcp';

export interface ToolMetadata {
  name: string;
  capabilities: string[]; // What this tool can do
  prerequisites: string[]; // What must be done first
  costEstimate: 'cheap' | 'moderate' | 'expensive'; // Execution cost
  successRate: number; // 0-1, historical success rate
  similarTools: string[]; // Related/alternative tools
  category: string; // 'read' | 'write' | 'analyze' | 'manage' etc
  latencyProfile: 'fast' | 'medium' | 'slow'; // Expected execution time
  errorHandling: 'retry' | 'fallback' | 'critical'; // How to handle failures
}
export interface ToolWithMetadata extends McpToolDefinition {
  metadata?: ToolMetadata;
}
export interface ToolRanking {
  toolName: string;
  score: number; // 0-1
  relevance: number; // 0-1 relevance to task
  confidence: number; // 0-1 confidence in recommendation
  prerequisites: string[]; // Must execute these first
  reasoning: string; // Why this tool
  alternatives: string[]; // Similar tools to consider
}
export interface TaskContext {
  taskDescription: string;
  goal: string;
  availableContext: Record<string, any>;
  previousResults?: Record<string, any>;
  constraints?: {
    maxCost?: 'cheap' | 'moderate' | 'expensive';
    maxLatency?: 'fast' | 'medium' | 'slow';
    requireRetry?: boolean;
  };
}
