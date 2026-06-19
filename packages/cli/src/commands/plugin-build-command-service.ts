import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import * as esbuild from 'esbuild';
import { PluginManifest } from '@fromcode119/core';
import { CliUtils } from '../utils';
import { PluginDependencyCommandService } from '../services/plugin-dependency-command-service';

export class PluginBuildCommandService {
  static register(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    PluginBuildCommandService.registerList(plugin);
    PluginBuildCommandService.registerDepsInstall(plugin, dependencyService);
    PluginBuildCommandService.registerDepsInstallAll(plugin, dependencyService);
    PluginBuildCommandService.registerTest(plugin, dependencyService);
    PluginBuildCommandService.registerDev(plugin);
    PluginBuildCommandService.registerBuild(plugin, dependencyService);
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

            let manifest: PluginManifest | null = null;
            for (const p of manifestPaths) {
              if (await fs.pathExists(p)) {
                manifest = await fs.readJson(p) as PluginManifest;
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
      .action(async (slug) => {
        console.log(chalk.blue(`\nStarting development mode for plugin: ${chalk.bold(slug)}...`));
        const build = spawn('fromcode', ['plugin', 'build', slug, '--watch'], { stdio: 'inherit', shell: true });
        build.on('exit', (code) => process.exit(code || 0));
      });
  }

  private static registerBuild(plugin: Command, dependencyService: PluginDependencyCommandService): void {
    plugin
      .command('build <slug>')
      .description('Build plugin UI assets')
      .option('-w, --watch', 'Watch for changes', false)
      .action(async (slug, options) => {
        try {
          const pluginsDir = CliUtils.getPluginsDir();
          const pluginDir = path.join(pluginsDir, slug);
          if (!fs.existsSync(pluginDir)) {
            console.error(chalk.red(`Plugin directory not found: ${pluginDir}`));
            return;
          }
          const uiDir = path.join(pluginDir, 'ui');
          if (!fs.existsSync(uiDir)) {
            console.log(chalk.yellow(`No ui directory found for plugin ${slug}. Skipping build.`));
            return;
          }
          const entryPoints = [
            path.join(uiDir, 'index.ts'),
            path.join(uiDir, 'index.js'),
            path.join(uiDir, 'main.ts'),
            path.join(uiDir, 'main.js')
          ].filter(p => fs.existsSync(p));
          if (entryPoints.length === 0) {
            console.error(chalk.red(CliUtils.t('cli.build.no_entry', { dir: uiDir, extra: ', main.ts/js' })));
            return;
          }
          const outDir = uiDir;
          const outFile = path.join(outDir, 'bundle.js');

          console.log(chalk.blue(CliUtils.t('cli.build.starting', { type: 'plugin UI', slug })));

          await CliUtils.compileStyles(uiDir);

          console.log(chalk.gray(`Entry: ${entryPoints[0]}`));
          console.log(chalk.gray(`Output: ${outFile}`));

          const external = await PluginBuildCommandService.resolveUiExternals(pluginDir);
          const buildOptions = PluginBuildCommandService.createUiBuildOptions(entryPoints[0], outFile, external);

          if (options.watch) {
            const ctx = await esbuild.context(buildOptions);
            await ctx.watch();
            console.log(chalk.green('UI build started in watch mode...'));
          } else {
            await esbuild.build(buildOptions);
            console.log(chalk.green('UI build completed successfully!'));
          }

          await PluginBuildCommandService.buildBackend(pluginDir, slug, dependencyService);

        } catch (error) {
          console.error(chalk.red('Error building plugin:'), error);
        }
      });
  }

  private static async resolveUiExternals(pluginDir: string): Promise<string[]> {
    let external = ['react', 'react-dom', '@fromcode119/react', '@fromcode119/sdk', '@fromcode119/admin', '@fromcode119/admin/components', 'lucide-react', 'react/jsx-runtime'];
    const manifestPath = path.join(pluginDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = await fs.readJson(manifestPath);
        if (manifest.runtimeModules) {
          const extraModules = Array.isArray(manifest.runtimeModules)
            ? manifest.runtimeModules
            : Object.keys(manifest.runtimeModules);
          external = [...new Set([...external, ...extraModules])];
        }
      } catch (e) { }
    }
    return external;
  }

  private static createUiBuildOptions(entryPoint: string, outFile: string, external: string[]): esbuild.BuildOptions {
    return {
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: outFile,
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl'
      },
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      external
    };
  }

  private static async buildBackend(
    pluginDir: string,
    slug: string,
    dependencyService: PluginDependencyCommandService,
  ): Promise<void> {
    const backendEntry = [
      path.join(pluginDir, 'index.ts'),
      path.join(pluginDir, 'index.js')
    ].find(p => fs.existsSync(p));

    if (backendEntry && backendEntry.endsWith('.ts')) {
      console.log(chalk.blue(CliUtils.t('cli.build.starting', { type: 'plugin backend', slug })));

      const backendExternal = await dependencyService.getBackendExternalModules(pluginDir);

      await esbuild.build({
        entryPoints: [backendEntry],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: path.join(pluginDir, 'index.js'),
        external: [
          '@fromcode119/sdk',
          '@fromcode119/core',
          '@fromcode119/database',
          '@fromcode119/media',
          '@fromcode119/email',
          '@fromcode119/cache',
          '@fromcode119/scheduler',
          'express',
          'knex',
          'drizzle-orm',
          'pg',
          ...backendExternal
        ],
        sourcemap: true,
        minify: false,
        logLevel: 'info',
      });

      console.log(chalk.green('Backend build completed successfully!'));
    }
  }
}
