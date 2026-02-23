import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { spawn } from 'child_process';
import * as esbuild from 'esbuild';
import { PluginManifest } from '@fromcode119/sdk';
import { getPluginsDir, ask, t, compileStyles, getMarketplace, getMarketplaceClient } from '../utils';

export function registerPluginCommands(program: Command) {
  const plugin = program.command('plugin').description('Manage plugins');

  plugin
    .command('create [name]')
    .description('Create a new plugin scaffold')
    .option('-s, --slug <slug>', 'Plugin slug')
    .option('-c, --category <category>', 'Plugin category')
    .action(async (name, options) => {
      try {
        let pluginName = name;
        if (!pluginName) {
          pluginName = await ask(chalk.blue('Plugin name: '));
        }

        if (!pluginName) {
          console.error(chalk.red('Plugin name is required!'));
          return;
        }

        let slug = options.slug;
        if (!slug) {
          let defaultSlug = pluginName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          slug = await ask(chalk.blue(`Plugin slug [${defaultSlug}]: `));
          if (!slug) slug = defaultSlug;
        }

        let category = options.category;
        if (!category) {
          category = await ask(chalk.blue('Plugin category [general]: '));
          if (!category) category = 'general';
        }

        const pluginsDir = getPluginsDir();
        const pluginPath = path.join(pluginsDir, slug);

        if (fs.existsSync(pluginPath)) {
          console.error(chalk.red(`Plugin directory already exists: ${pluginPath}`));
          return;
        }

        console.log(chalk.green(`\nCreating plugin "${pluginName}" in ${pluginPath}...`));

        // Create directory structure
        await fs.ensureDir(pluginPath);
        await fs.ensureDir(path.join(pluginPath, 'admin'));
        await fs.ensureDir(path.join(pluginPath, 'ui'));

        // 1. manifest.json
        const manifest = {
          slug,
          name: pluginName,
          version: '1.0.0',
          category,
          main: 'index.js',
          capabilities: ['api', 'admin', 'ui', 'database', 'hooks', 'i18n']
        };
        await fs.writeJson(path.join(pluginPath, 'manifest.json'), manifest, { spaces: 2 });

        // 2. index.js
        const indexJs = `
module.exports = {
  async onInit(context) {
    const { logger } = context;
    logger.info("${pluginName} Plugin Initialized!");
    
    // Example API route
    context.api.get("/api/${slug}/hello", (req, res) => {
      res.json({ message: "Hello from ${pluginName}!" });
    });

    // Example Translation registration
    context.i18n.registerTranslations('en', {
      '${slug}.welcome': 'Welcome to ${pluginName}!'
    });
  },
  async onEnable(context) {
    context.logger.info("${pluginName} Plugin Enabled!");
  },
  async onDisable(context) {
    context.logger.info("${pluginName} Plugin Disabled!");
  }
};
`;
        await fs.writeFile(path.join(pluginPath, 'index.js'), indexJs.trim() + '\n');

        // 3. admin/DashboardWidget.tsx
        const dashboardWidget = `
import React from 'react';

const DashboardWidget = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px', margin: '10px 0' }}>
      <h3>Dashboard Widget from ${pluginName}</h3>
    </div>
  );
};

export default DashboardWidget;
`;
        await fs.writeFile(path.join(pluginPath, 'admin/DashboardWidget.tsx'), dashboardWidget.trim() + '\n');

        // 4. ui/banner.tsx
        const banner = `
import React from 'react';

const Banner = () => {
  return (
    <div style={{ padding: '15px', backgroundColor: '#e0e0e0', textAlign: 'center', borderRadius: '8px', margin: '10px 0' }}>
      <div key="msg">Welcome to ${pluginName} Banner!</div>
    </div>
  );
};

export default Banner;
`;
        await fs.writeFile(path.join(pluginPath, 'ui/banner.tsx'), banner.trim() + '\n');

        // 5. ui/index.ts
        const uiIndex = `
import Banner from './banner';

export const slots = {
  'frontend.home.hero': {
    component: Banner,
    priority: 10
  }
};

export const init = () => {
  console.log('[${slug}] UI Initialized');
};

// --- Self-Registration ---
if (typeof window !== 'undefined' && (window as any).Fromcode) {
  const Fromcode = (window as any).Fromcode;
  
  // Register slots
  Object.entries(slots).forEach(([slotName, config]: [string, any]) => {
    Fromcode.registerSlotComponent(slotName, {
      ...config,
      pluginSlug: '${slug}'
    });
  });

  // Run initialization
  init();
}
`;
        await fs.writeFile(path.join(pluginPath, 'ui/index.ts'), uiIndex.trim() + '\n');

        console.log(chalk.green('\nPlugin scaffolded successfully!'));
        console.log(chalk.gray(`Location: ${pluginPath}`));

      } catch (error) {
        console.error(chalk.red('Error creating plugin:'), error);
      }
    });

  plugin
    .command('publish <slug>')
    .description('Publish a plugin to the marketplace')
    .option('-v, --version <semver>', 'Specify version to publish')
    .action(async (slug, options) => {
      try {
        console.log(chalk.blue(`\nPreparing to publish plugin: ${slug}...`));
        
        const pluginsDir = getPluginsDir();
        const pluginPath = path.join(pluginsDir, slug);
        
        if (!fs.existsSync(pluginPath)) {
          console.error(chalk.red(`Plugin directory not found: ${pluginPath}`));
          return;
        }

        const marketplace = getMarketplaceClient();
        const tempDir = path.resolve(process.cwd(), '.tmp');
        await fs.ensureDir(tempDir);

        console.log(chalk.gray('Packaging plugin files...'));
        const zipPath = await marketplace.pack(pluginPath, tempDir);
        console.log(chalk.green(`✔ Created package ${path.basename(zipPath)}`));

        console.log(chalk.blue('\nUploading to Fromcode Marketplace...'));
        const result = await marketplace.publish(zipPath);
        
        if (result.success) {
          console.log(chalk.green(`✔ Plugin ${slug} published successfully!`));
          
          const baseUrl = process.env.MARKETPLACE_URL?.replace('/marketplace.json', '') || 'https://marketplace.fromcode.com';
          console.log(chalk.gray(`Access it at: ${baseUrl}/plugins/${slug}`));
        } else {
          throw new Error(result.message || 'Upload failed');
        }

        // Cleanup
        await fs.remove(zipPath);

      } catch (error: any) {
        console.error(chalk.red('\nPublish failed:'), error.message);
      }
    });

  plugin
    .command('list')
    .description('List all installed plugins')
    .action(async () => {
      try {
        const pluginsDir = getPluginsDir();
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

  plugin
    .command('test <slug>')
    .description('Run tests for a plugin')
    .action(async (slug) => {
      try {
        const pluginsDir = getPluginsDir();
        const pluginDir = path.join(pluginsDir, slug);
        if (!fs.existsSync(pluginDir)) {
          console.error(chalk.red(`Plugin directory not found: ${pluginDir}`));
          return;
        }

        console.log(chalk.blue(`\nRunning tests for plugin: ${chalk.bold(slug)}...`));
        
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

  plugin
    .command('dev <slug>')
    .description('Start plugin in development mode (watch assets)')
    .action(async (slug) => {
      console.log(chalk.blue(`\nStarting development mode for plugin: ${chalk.bold(slug)}...`));
      const build = spawn('fromcode', ['plugin', 'build', slug, '--watch'], { stdio: 'inherit', shell: true });
      build.on('exit', (code) => process.exit(code || 0));
    });

  plugin
    .command('build <slug>')
    .description('Build plugin UI assets')
    .option('-w, --watch', 'Watch for changes', false)
    .action(async (slug, options) => {
      try {
        const pluginsDir = getPluginsDir();
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
          console.error(chalk.red(t('cli.build.no_entry', { dir: uiDir, extra: ', main.ts/js' })));
          return;
        }

        const outDir = uiDir;
        const outFile = path.join(outDir, 'bundle.js');

        console.log(chalk.blue(t('cli.build.starting', { type: 'plugin UI', slug })));
        
        await compileStyles(uiDir);

        console.log(chalk.gray(`Entry: ${entryPoints[0]}`));
        console.log(chalk.gray(`Output: ${outFile}`));

        let external = ['react', 'react-dom', '@fromcode119/react', '@fromcode119/admin', '@fromcode119/admin/components', 'lucide-react', 'react/jsx-runtime'];
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
          } catch (e) {}
        }

        const buildOptions: esbuild.BuildOptions = {
          entryPoints: [entryPoints[0]],
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

        if (options.watch) {
          const ctx = await esbuild.context(buildOptions);
          await ctx.watch();
          console.log(chalk.green('UI build started in watch mode...'));
        } else {
          await esbuild.build(buildOptions);
          console.log(chalk.green('UI build completed successfully!'));
        }

        const backendEntry = [
          path.join(pluginDir, 'index.ts'),
          path.join(pluginDir, 'index.js')
        ].find(p => fs.existsSync(p));

        if (backendEntry && backendEntry.endsWith('.ts')) {
          console.log(chalk.blue(t('cli.build.starting', { type: 'plugin backend', slug })));
          
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
              'pg'
            ],
            sourcemap: true,
            minify: false,
            logLevel: 'info',
          });
          
          console.log(chalk.green('Backend build completed successfully!'));
        }

      } catch (error) {
        console.error(chalk.red('Error building plugin:'), error);
      }
    });

  plugin
    .command('pack <slug>')
    .description('Pack a plugin into a ZIP for the marketplace')
    .action(async (slug) => {
      try {
        const pluginsDir = getPluginsDir();
        const pluginPath = path.join(pluginsDir, slug);

        if (!fs.existsSync(pluginPath)) {
          console.error(chalk.red(`Plugin directory not found: ${pluginPath}`));
          return;
        }

        const outDir = path.resolve(process.cwd(), 'dist');
        const marketplace = getMarketplaceClient();

        console.log(chalk.blue(`\nPacking ${chalk.bold(slug)}...`));
        const zipPath = await marketplace.pack(pluginPath, outDir);

        console.log(chalk.green(`\nPlugin packed successfully!`));
        console.log(chalk.gray(`Output: ${zipPath}`));

      } catch (error) {
        console.error(chalk.red('Error packing plugin:'), error);
      }
    });

  plugin
    .command('search [query]')
    .description('Search for plugins in the marketplace')
    .action(async (query) => {
      try {
        const marketplace = getMarketplace();
        console.log(chalk.blue(`\nSearching marketplace...`));
        
        const plugins = await marketplace.searchPlugins(query || '');

        console.log(chalk.white(`Found ${plugins.length} plugins:`));
        console.log(chalk.gray('--------------------------------------------------'));

        for (const p of plugins) {
          console.log(`${chalk.bold(p.name)} (${chalk.cyan(p.slug)}) v${p.version}`);
          console.log(chalk.gray(`  ${p.description || 'No description'}`));
          console.log(chalk.gray(`  Author: ${p.author || 'unknown'}`));
          console.log('');
        }
      } catch (error: any) {
        console.error(chalk.red('Error searching marketplace:'), error.message);
      }
    });

  plugin
    .command('install <slug>')
    .description('Install a plugin from the marketplace')
    .action(async (slug) => {
      try {
        const marketplace = getMarketplace();
        console.log(chalk.blue(`\nInstalling plugin: ${chalk.bold(slug)}...`));
        
        const manifest = await marketplace.downloadAndInstall(slug);
        
        console.log(chalk.green(`\nPlugin ${chalk.bold(slug)} (v${manifest.version}) installed successfully!`));

      } catch (error: any) {
        console.error(chalk.red('\nInstallation failed:'), error.message);
      }
    });
}
