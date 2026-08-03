import { ToolFailureMode } from '@ai/api/forge/enums/tool-failure-mode.enum';
import { SpeedTier } from '@ai/api/forge/enums/speed-tier.enum';
import { CostTier } from '@ai/api/forge/enums/cost-tier.enum';

export interface IToolMetadata {
  [key: string]: unknown;
  name: string;
  capabilities: string[]; // What this tool can do
  prerequisites: string[]; // What must be done first
  costEstimate: CostTier; // Execution cost
  successRate: number; // 0-1, historical success rate
  similarTools: string[]; // Related/alternative tools
  category: string; // 'read' | 'write' | 'analyze' | 'manage' etc
  latencyProfile: SpeedTier; // Expected execution time
  errorHandling: ToolFailureMode; // How to handle failures
}
