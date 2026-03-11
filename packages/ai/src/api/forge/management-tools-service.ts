import { PluginManager, ThemeManager } from '@fromcode119/core';
import type { McpToolDefinition } from '@fromcode119/mcp';
import { BackupTools } from './tools/backup-tools';
import { AssistantToolingHelpers } from './tools/helpers';
import { PluginTools } from './tools/plugin-tools';
import { ThemeTools } from './tools/theme-tools';

export class AssistantManagementToolsService {
  constructor(private manager: PluginManager, private themeManager: ThemeManager) {}

  public normalizeSearchText(value: string): string {
    return this.createHelpers().normalizeSearchText(value);
  }

  public buildTools(): McpToolDefinition[] {
    const helpers = this.createHelpers();
    return [
      ...PluginTools.buildPluginManagementTools({ manager: this.manager, helpers }),
      ...ThemeTools.buildThemeManagementTools({ themeManager: this.themeManager, helpers }),
      ...BackupTools.buildBackupManagementTools(),
    ];
  }

  private createHelpers(): AssistantToolingHelpers {
    return new AssistantToolingHelpers(this.manager, this.themeManager);
  }
}