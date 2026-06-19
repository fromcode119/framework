import { Command } from 'commander';
import { PluginDependencyCommandService } from '../services/plugin-dependency-command-service';
import { PluginScaffoldCommandService } from './plugin-scaffold-command-service';
import { PluginMarketplaceCommandService } from './plugin-marketplace-command-service';
import { PluginBuildCommandService } from './plugin-build-command-service';
import { PluginStateCommandService } from '../services/plugin-state-command-service';
import { PluginUpdateCommandService } from '../services/plugin-update-command-service';

export class PluginCommands {
  static registerPluginCommands(program: Command) {
    const plugin = program.command('plugin').description('Manage plugins');
    const dependencyService = new PluginDependencyCommandService();

    PluginScaffoldCommandService.register(plugin);
    PluginMarketplaceCommandService.register(plugin);
    PluginBuildCommandService.register(plugin, dependencyService);
    PluginStateCommandService.register(plugin);
    PluginUpdateCommandService.register(plugin);
  }
}
