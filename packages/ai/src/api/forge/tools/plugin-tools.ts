import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, PluginManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';
import { PluginReadTools } from '@ai/api/forge/tools/plugin-read-tools';
import { PluginWriteTools } from '@ai/api/forge/tools/plugin-write-tools';

/**
 * Every plugin tool an assistant can be given, read and write together.
 *
 * The definitions live in `PluginReadTools` and `PluginWriteTools`; this is the one list callers ask
 * for. Splitting them by permission rather than alphabetically is what makes a read-only grant
 * possible — see either class.
 */
export class PluginTools {
  static buildPluginManagementTools(input: { manager: PluginManager; helpers: AssistantToolingHelpers }): IMcpToolDefinition[] {
    return [...PluginReadTools.build(input), ...PluginWriteTools.build(input)];
  }
}
