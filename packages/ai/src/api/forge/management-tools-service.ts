import { PluginManager, ThemeManager } from '@fromcode119/core';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { BackupTools } from '@ai/api/forge/tools/backup-tools';
import { AssistantToolingHelpers } from '@ai/api/forge/tools/helpers';
import { PluginTools } from '@ai/api/forge/tools/plugin-tools';
import { ThemeTools } from '@ai/api/forge/tools/theme-tools';

export class AssistantManagementToolsService {
  constructor(private manager: PluginManager, private themeManager: ThemeManager) {}

  public normalizeSearchText(value: string): string {
    return this.createHelpers().normalizeSearchText(value);
  }

  public buildTools(): IMcpToolDefinition[] {
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