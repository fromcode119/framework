import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { IPluginManifest } from '@fromcode119/core';
import { CliUtils } from '@cli/utils';
import { PluginDependencyCommandService } from '@cli/services/plugin-dependency-command-service';
import { PluginBuildCommandService } from '@cli/services/plugin-build-command-service';

/**
 * Plugin operational commands that are NOT build: `list`, `deps-install(-all)`, `test`, plus
 * registering `build`/`dev`, whose own logic lives in `services/plugin-build-command-service.ts` (the
 * same split #100 made for themes — build+watch is a program in its own right).
 */
export class PluginOpsCommandService {
  static register(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    PluginOpsCommandService.registerList(plugin);
    PluginOpsCommandService.registerDepsInstall(plugin, dependencyService);
    PluginOpsCommandService.registerDepsInstallAll(plugin, dependencyService);
    PluginOpsCommandService.registerTest(plugin, dependencyService);
    PluginOpsCommandService.registerDev(plugin);
    PluginOpsCommandService.registerBuild(plugin);
  }

  private static registerList(plugin: Command): void {
    plugin
      .command('list')
      .description('List all installed plugins')
      .action(async () => {
        try {
          const pluginsDir = CliUtils.getPluginsDir();
          if (!fs.existsSync(pluginsDir)) {
            console.log(chalk.yellow('No plugins directory found.'));
            return;
          }

          const dirs = await fs.readdir(pluginsDir);
          console.log(chalk.blue('\nInstalled Plugins:'));
          console.log(chalk.gray('--------------------------------------------------'));

          for (const dir of dirs) {
            if (dir.startsWith('.')) continue;
            const manifestPaths = [
              path.join(pluginsDir, dir, 'manifest.json'),
              path.join(pluginsDir, dir, 'plugin.json') // Support older format
            ];

            let manifest: IPluginManifest | null = null;
            for (const p of manifestPaths) {
              if (await fs.pathExists(p)) {
                manifest = await fs.readJson(p) as IPluginManifest;
                break;
              }
            }

            if (manifest) {
              console.log(`${chalk.bold(manifest.name)} (${chalk.cyan(manifest.slug || dir)}) v${manifest.version}`);
              console.log(chalk.gray(`  Category: ${manifest.category || 'unknown'}`));
              console.log(chalk.gray(`  Capabilities: ${manifest.capabilities?.join(', ') || 'none'}`));
              console.log('');
            }
          }
        } catch (error) {
          console.error(chalk.red('Error listing plugins:'), error);
        }
      });
  }

  private static registerDepsInstall(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    plugin
      .command('deps-install <slug>')
      .description('Install backend npm dependencies for a plugin')
      .action(async (slug) => {
        try {
          const pluginDir = await dependencyService.installForSlug(slug);
          console.log(chalk.green(`Plugin dependencies installed for ${pluginDir}`));
        } catch (error) {
          console.error(chalk.red('Error installing plugin dependencies:'), error);
        }
      });
  }

  private static registerDepsInstallAll(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    plugin
      .command('deps-install-all')
      .description('Install backend npm dependencies for all plugins')
      .action(async () => {
        try {
          const installed = await dependencyService.installAll();
          console.log(chalk.green(`Plugin dependency install pass completed for ${installed} plugin(s).`));
        } catch (error) {
          console.error(chalk.red('Error installing plugin dependencies:'), error);
        }
      });
  }

  private static registerTest(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    plugin
      .command('test <slug>')
      .description('Run tests for a plugin')
      .action(async (slug) => {
        try {
          const pluginsDir = CliUtils.getPluginsDir();
          const pluginDir = path.join(pluginsDir, slug);
          if (!fs.existsSync(pluginDir)) {
            console.error(chalk.red(`Plugin directory not found: ${pluginDir}`));
            return;
          }

          console.log(chalk.blue(`\nRunning tests for plugin: ${chalk.bold(slug)}...`));
          await dependencyService.installForSlug(slug);

          const pkgPath = path.join(pluginDir, 'package.json');
          let command = 'npm test';
          let args: string[] = [];

          if (fs.existsSync(pkgPath)) {
            const pkg = await fs.readJson(pkgPath);
            if (pkg.scripts?.test) {
              // Use plugin's own test script
            } else {
              command = 'npx';
              args = ['vitest', 'run', '--dir', pluginDir];
            }
          } else {
            command = 'npx';
            args = ['vitest', 'run', '--dir', pluginDir];
          }

          const testProcess = spawn(command, args, { stdio: 'inherit', shell: true, cwd: pluginDir });
          testProcess.on('exit', (code) => {
            if (code === 0) {
              console.log(chalk.green('\nTests passed!'));
            } else {
              console.error(chalk.red('\nTests failed!'));
            }
          });
        } catch (error) {
          console.error(chalk.red('Error running plugin tests:'), error);
        }
      });
  }

  private static registerDev(plugin: Command): void {
    plugin
      .command('dev <slug>')
      .description('Start plugin in development mode (watch assets)')
      .action(async (slug) => { await PluginBuildCommandService.build(slug, { watch: true }); });
  }

  private static registerBuild(plugin: Command): void {
    plugin
      .command('build <slug>')
      .description('Build plugin UI assets')
      .option('-w, --watch', 'Watch for changes', false)
      .action(async (slug, options) => { await PluginBuildCommandService.build(slug, { watch: options.watch }); });
  }
}
