import { Command } from 'commander';
import { PluginDependencyCommandService } from '@cli/services/plugin-dependency-command-service';
import { PluginScaffoldCommandService } from '@cli/commands/plugin-scaffold-command-service';
import { PluginMarketplaceCommandService } from '@cli/commands/plugin-marketplace-command-service';
import { PluginBuildCommandService } from '@cli/commands/plugin-build-command-service';
import { PluginStateCommandService } from '@cli/services/plugin-state-command-service';
import { PluginUpdateCommandService } from '@cli/services/plugin-update-command-service';
import { PluginPreflightCommandService } from '@cli/services/plugin-preflight-command-service';

export class PluginCommands {
  static registerPluginCommands(program: Command) {
    const plugin = program.command('plugin').description('Manage plugins');
    const dependencyService = new PluginDependencyCommandService();

    PluginScaffoldCommandService.register(plugin);
    PluginMarketplaceCommandService.register(plugin);
    PluginBuildCommandService.register(plugin, dependencyService);
    PluginStateCommandService.register(plugin);
    PluginUpdateCommandService.register(plugin);
    PluginPreflightCommandService.register(plugin);
  }
}
