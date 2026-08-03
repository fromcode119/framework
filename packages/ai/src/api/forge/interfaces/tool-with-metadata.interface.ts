import { IMcpToolDefinition } from '@fromcode119/mcp';
import type { IToolMetadata } from '@ai/api/forge/interfaces/tool-metadata.interface';

export interface IToolWithMetadata extends IMcpToolDefinition {
  metadata?: IToolMetadata;
}
