import type { IAssistantToolMetadata } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-metadata.interface';
import type { IMcpToolDefinition } from '@fromcode119/mcp';

/**
 * The slice of an MCP tool definition the assistant surfaces, plus our own metadata.
 *
 * An `interface` rather than a `type` intersection: an interface can `extend` a mapped type such as
 * `Pick<…>`, so the derivation from `IMcpToolDefinition` is preserved without an alias — the tool list
 * cannot drift from the definition it is picked from.
 */
export interface IAssistantToolSummary extends Pick<IMcpToolDefinition, 'tool' | 'description' | 'readOnly'> {
  metadata?: IAssistantToolMetadata;
}
