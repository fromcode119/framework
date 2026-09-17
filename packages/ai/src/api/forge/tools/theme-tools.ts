import { ExtensionArea } from '@ai/api/forge/enums/extension-area.enum';
import { TypeUtils, ThemeManager } from '@fromcode119/core';
import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';
import { ThemeReadTools } from '@ai/api/forge/tools/theme-read-tools';
import { ThemeWriteTools } from '@ai/api/forge/tools/theme-write-tools';

/**
 * Every theme tool an assistant can be given, read and write together.
 *
 * The definitions live in `ThemeReadTools` and `ThemeWriteTools`; this is the one list callers ask
 * for. They are split by PERMISSION rather than by name, which is what makes a read-only grant
 * possible.
 */
export class ThemeTools {
  static buildThemeManagementTools(input: { themeManager: ThemeManager; helpers: AssistantToolingHelpers }): IMcpToolDefinition[] {
    return [...ThemeReadTools.build(input), ...ThemeWriteTools.build(input)];
  }
}
