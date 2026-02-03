#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import * as readline from 'readline';
import fetch, { Response } from 'node-fetch';
import extract from 'extract-zip';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import * as esbuild from 'esbuild';
import * as sass from 'sass';
import * as less from 'less';

const program = new Command();

const translations = {
  en: {
    'cli.status.checking': 'Checking registry at {{registry}}...',
    'cli.status.no_core': 'Registry does not provide core version information yet.',
    'cli.status.new_version': '\nA newer version of Fromcode Core is available: {{version}}',
    'cli.status.update_hint': 'Use "fromcode core update" to apply the update.',
    'cli.status.latest': '\nYou are running the latest version of Fromcode Core.',
    'cli.build.no_ui': 'No ui directory found for {{type}} {{slug}}. Skipping build.',
    'cli.build.no_entry': 'No entry point found in {{dir}} (index.ts/js{{extra}})',
    'cli.build.compiling': 'Compiling {{type}}: {{in}} -> {{out}}',
    'cli.build.starting': '\nBuilding UI for {{type}} {{slug}}...',
    'cli.build.success': 'Build completed successfully!',
    'cli.pack.starting': '\nPacking {{slug}} v{{version}}...',
    'cli.pack.success': '\nPacked successfully!',
    'cli.install.fetching': '\nFetching {{type}} info for {{slug}}...',
    'cli.install.downloading': 'Downloading {{slug}} v{{version}}...',
    'cli.install.extracting': 'Extracting to {{dir}}...',
    'cli.install.success': '\n{{type}} {{slug}} installed successfully!'
  }
};

const currentLocale = 'en';
function t(key: string, params: Record<string, string> = {}, defaultValue?: string): string {
  let text = (translations as any)[currentLocale][key] || defaultValue || key;
  Object.keys(params).forEach(p => {
    text = text.replace(`{{${p}}}`, params[p]);
  });
  return text;
}

interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  category?: string;
  capabilities?: string[];
  description?: string;
  author?: string;
  downloadUrl?: string;
}

interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  author?: string;
  downloadUrl?: string;
}

interface RegistryCore {
  version: string;
  downloadUrl: string;
}

interface Registry {
  core?: RegistryCore;
  plugins?: PluginManifest[];
  themes?: ThemeManifest[];
}

function getProjectRoot(): string {
  let current = process.cwd();
  // Traverse up to find a directory containing 'plugins' or 'themes' or a project root marker
  while (current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, 'plugins')) || fs.existsSync(path.join(current, 'themes'))) {
      return current;
    }
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === '@fromcode/framework') return current;
        } catch {}
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function getPluginsDir(): string {
  const root = getProjectRoot();
  const dir = path.resolve(root, 'plugins');
  if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
  return dir;
}

function getThemesDir(): string {
  const root = getProjectRoot();
  const dir = path.resolve(root, 'themes');
  if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
  return dir;
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function compileStyles(uiDir: string): Promise<void> {
  const sassEntries = [
    { in: 'theme.scss', out: 'theme.css' },
    { in: 'index.scss', out: 'index.css' },
    { in: 'style.scss', out: 'style.css' }
  ];

  for (const entry of sassEntries) {
    const fullInPath = path.join(uiDir, entry.in);
    if (fs.existsSync(fullInPath)) {
      console.log(chalk.gray(`Compiling SCSS: ${entry.in} -> ${entry.out}`));
      const result = sass.compile(fullInPath);
      await fs.writeFile(path.join(uiDir, entry.out), result.css);
    }
  }

  const lessEntries = [
    { in: 'theme.less', out: 'theme.css' },
    { in: 'index.less', out: 'index.css' },
    { in: 'style.less', out: 'style.css' }
  ];

  for (const entry of lessEntries) {
    const fullInPath = path.join(uiDir, entry.in);
    if (fs.existsSync(fullInPath)) {
      console.log(chalk.gray(`Compiling Less: ${entry.in} -> ${entry.out}`));
      const content = await fs.readFile(fullInPath, 'utf8');
      const result = await less.render(content);
      await fs.writeFile(path.join(uiDir, entry.out), result.css);
    }
  }
}

program
  .name('fromcode')
  .description('Fromcode Framework CLI')
  .version('0.1.0');

const core = program.command('core').description('Manage framework core');

core
  .command('status')
  .description('Check framework core status and updates')
  .option('-r, --registry <url>', 'Registry URL', process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json')
  .action(async (options) => {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (!fs.existsSync(pkgPath)) {
        console.error(chalk.red('package.json not found in current directory. Are you in the project root?'));
        return;
      }

      const pkg = await fs.readJson(pkgPath);
      const currentVersion = pkg.version || 'unknown';
      console.log(`${chalk.blue('Fromcode Core Version:')} ${chalk.bold(currentVersion)}`);

      console.log(chalk.gray(`\nChecking registry at ${options.registry}...`));
      const response = await fetch(options.registry);
      if (!response.ok) throw new Error(`Registry unavailable: ${response.statusText}`);
      
      const registry = (await response.json()) as Registry;
      if (!registry.core) {
        console.log(chalk.yellow('Registry does not provide core version information yet.'));
        return;
      }

      const latestVersion = registry.core.version;
      if (latestVersion !== currentVersion) {
        console.log(chalk.green(`\nA newer version of Fromcode Core is available: ${chalk.bold(latestVersion)}`));
        console.log(chalk.gray(`Use 'fromcode core update' to apply the update.`));
      } else {
        console.log(chalk.green('\nYou are running the latest version of Fromcode Core.'));
      }
    } catch (error) {
      console.error(chalk.red('Error checking core status:'), error);
    }
  });

core
  .command('update')
  .description('Update framework core to the latest version')
  .option('-r, --registry <url>', 'Registry URL', process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json')
  .action(async (options) => {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (!fs.existsSync(pkgPath)) {
        console.error(chalk.red('package.json not found. Core update must be run from project root.'));
        return;
      }

      const pkg = await fs.readJson(pkgPath);
      const currentVersion = pkg.version || '0.0.0';

      console.log(chalk.blue(`\nFetching latest core info from ${options.registry}...`));
      const response = await fetch(options.registry);
      const registry = (await response.json()) as Registry;

      if (!registry.core) {
        console.error(chalk.red('No core update information found in registry.'));
        return;
      }

      const latestVersion = registry.core.version;
      if (latestVersion === currentVersion) {
        console.log(chalk.green('You are already on the latest version.'));
        return;
      }

      const confirm = await ask(chalk.yellow(`Update core from ${currentVersion} to ${latestVersion}? This will overwrite core files. (y/N): `));
      if (confirm.toLowerCase() !== 'y') {
        console.log('Update cancelled.');
        return;
      }

      const downloadUrl = new URL(registry.core.downloadUrl, options.registry).toString();
      console.log(chalk.cyan(`Downloading Core v${latestVersion} from ${downloadUrl}...`));

      const zipResponse = await fetch(downloadUrl);
      if (!zipResponse.ok) throw new Error(`Download failed: ${zipResponse.statusText}`);
      if (!zipResponse.body) throw new Error('Empty response body');

      const tmpZip = path.resolve(process.cwd(), `core-update-${latestVersion}.zip`);
      const fileStream = fs.createWriteStream(tmpZip);
      await pipeline(zipResponse.body as unknown as Readable, fileStream);

      console.log(chalk.cyan('Creating backup of current core...'));
      const backupDir = path.resolve(process.cwd(), '.backups', `core-${currentVersion}-${Date.now()}`);
      await fs.ensureDir(backupDir);
      
      // Define core folders to backup (example)
      const coreFolders = ['packages', 'package.json', 'tsconfig.json'];
      for (const folder of coreFolders) {
        if (fs.existsSync(path.resolve(process.cwd(), folder))) {
          await fs.copy(path.resolve(process.cwd(), folder), path.join(backupDir, folder));
        }
      }

      console.log(chalk.cyan('Applying update...'));
      await extract(tmpZip, { dir: process.cwd() });
      
      // Cleanup
      await fs.remove(tmpZip);
      
      console.log(chalk.green(`\nFromcode Core updated successfully to v${latestVersion}!`));
      console.log(chalk.yellow('Please run "npm install" to ensure all dependencies are updated.'));

    } catch (error) {
      console.error(chalk.red('Error updating core:'), error);
    }
  });

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

      // 4. ui/Banner.tsx
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
      await fs.writeFile(path.join(pluginPath, 'ui/Banner.tsx'), banner.trim() + '\n');

      // 5. ui/index.ts
      const uiIndex = `
import Banner from './Banner';

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

      console.log(chalk.blue(t('cli.build.starting', { type: 'plugin', slug })));
      
      // Compile styles first
      await compileStyles(uiDir);

      console.log(chalk.gray(`Entry: ${entryPoints[0]}`));
      console.log(chalk.gray(`Output: ${outFile}`));

      let external = ['react', 'react-dom', '@fromcode/react', '@fromcode/admin', '@fromcode/admin/components', 'lucide-react', 'react/jsx-runtime'];
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
        console.log(chalk.green('Build started in watch mode...'));
      } else {
        await esbuild.build(buildOptions);
        console.log(chalk.green('Build completed successfully!'));
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

      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red(`manifest.json not found in ${pluginPath}`));
        return;
      }

      const manifest = await fs.readJson(manifestPath);
      const version = manifest.version;
      const outDir = path.resolve(process.cwd(), 'dist');
      await fs.ensureDir(outDir);
      
      const zipName = `${slug}-${version}.zip`;
      const zipPath = path.join(outDir, zipName);

      console.log(chalk.blue(`\nPacking ${chalk.bold(slug)} v${version}...`));
      
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => { throw err; });
      archive.pipe(output);
      archive.directory(pluginPath, false);
      await archive.finalize();

      console.log(chalk.green(`\nPlugin packed successfully!`));
      console.log(chalk.gray(`Output: ${zipPath}`));

    } catch (error) {
      console.error(chalk.red('Error packing plugin:'), error);
    }
  });

plugin
  .command('search [query]')
  .description('Search for plugins in the registry')
  .option('-r, --registry <url>', 'Registry URL', process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json')
  .action(async (query, options) => {
    try {
      console.log(chalk.blue(`\nSearching registry: ${options.registry}...`));
      const response = await fetch(options.registry);
      if (!response.ok) throw new Error(`Failed to fetch registry: ${response.statusText}`);
      
      const registry = (await response.json()) as Registry;
      const plugins = registry.plugins || [];
      
      const filtered = query 
        ? plugins.filter((p: PluginManifest) => (p.name?.toLowerCase().includes(query.toLowerCase()) || p.slug.toLowerCase().includes(query.toLowerCase())))
        : plugins;

      console.log(chalk.white(`Found ${filtered.length} plugins:`));
      console.log(chalk.gray('--------------------------------------------------'));

      for (const p of filtered) {
        console.log(`${chalk.bold(p.name)} (${chalk.cyan(p.slug)}) v${p.version}`);
        console.log(chalk.gray(`  ${p.description || 'No description'}`));
        console.log(chalk.gray(`  Author: ${p.author || 'unknown'}`));
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('Error searching registry:'), error);
    }
  });

plugin
  .command('install <slug>')
  .description('Install a plugin from the registry')
  .option('-r, --registry <url>', 'Registry URL', process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json')
  .action(async (slug, options) => {
    try {
      console.log(chalk.blue(`\nFetching plugin info for ${chalk.bold(slug)}...`));
      const response = await fetch(options.registry);
      if (!response.ok) throw new Error(`Failed to fetch registry: ${response.statusText}`);
      
      const registry = (await response.json()) as Registry;
      const pluginInfo = registry.plugins?.find((p: PluginManifest) => p.slug === slug);

      if (!pluginInfo) {
        console.error(chalk.red(`Plugin not found in registry: ${slug}`));
        return;
      }

      const version = pluginInfo.version;
      if (!pluginInfo.downloadUrl) {
        console.error(chalk.red(`No download URL found for plugin: ${slug}`));
        return;
      }
      const downloadUrl = new URL(pluginInfo.downloadUrl, options.registry).toString();
      
      console.log(chalk.cyan(`Downloading ${slug} v${version}...`));
      console.log(chalk.gray(`Source: ${downloadUrl}`));
      const zipResponse = await fetch(downloadUrl);
      if (!zipResponse.ok) throw new Error(`Failed to download plugin: ${zipResponse.statusText}`);
      if (!zipResponse.body) throw new Error(`Failed to download plugin: response body is null`);

      const tmpZip = path.resolve(process.cwd(), `tmp-${slug}.zip`);
      const fileStream = fs.createWriteStream(tmpZip);
      await pipeline(zipResponse.body as unknown as Readable, fileStream);

      const pluginsDir = getPluginsDir();
      await fs.ensureDir(pluginsDir);
      
      const targetDir = path.join(pluginsDir, slug);
      if (fs.existsSync(targetDir)) {
        const confirm = await ask(chalk.yellow(`Plugin ${slug} already exists. Overwrite? (y/N): `));
        if (confirm.toLowerCase() !== 'y') {
          await fs.remove(tmpZip);
          console.log('Installation cancelled.');
          return;
        }
        await fs.remove(targetDir);
      }

      console.log(chalk.cyan(`Extracting to plugins/${slug}...`));
      await fs.ensureDir(targetDir);
      await extract(tmpZip, { dir: targetDir });
      
      // Cleanup
      await fs.remove(tmpZip);
      
      console.log(chalk.green(`\nPlugin ${chalk.bold(slug)} installed successfully!`));

    } catch (error) {
      console.error(chalk.red('Error installing plugin:'), error);
    }
  });

const theme = program.command('theme').description('Manage themes');

theme
  .command('create [name]')
  .description('Create a new theme scaffold')
  .option('-s, --slug <slug>', 'Theme slug')
  .action(async (name, options) => {
    try {
      let themeName = name;
      if (!themeName) {
        themeName = await ask(chalk.blue('Theme name: '));
      }

      if (!themeName) {
        console.error(chalk.red('Theme name is required!'));
        return;
      }

      let slug = options.slug;
      if (!slug) {
        let defaultSlug = themeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        slug = await ask(chalk.blue(`Theme slug [${defaultSlug}]: `));
        if (!slug) slug = defaultSlug;
      }

      const themesDir = getThemesDir();
      const themePath = path.join(themesDir, slug);

      if (fs.existsSync(themePath)) {
        console.error(chalk.red(`Theme directory already exists: ${themePath}`));
        return;
      }

      console.log(chalk.green(`\nCreating theme "${themeName}" in ${themePath}...`));

      await fs.ensureDir(themePath);
      await fs.ensureDir(path.join(themePath, 'ui'));

      // 1. theme.json
      const manifest = {
        slug,
        name: themeName,
        version: '1.0.0',
        author: 'Unknown',
        variables: {
          '--primary': '#3b82f6',
          '--secondary': '#1e293b',
          '--background': '#ffffff',
          '--foreground': '#0f172a'
        },
        ui: {
          entry: 'bundle.js',
          css: ['theme.css']
        },
        layouts: [
          { name: 'default', label: 'Default Layout', description: 'Main layout for the theme' }
        ]
      };
      await fs.writeJson(path.join(themePath, 'theme.json'), manifest, { spaces: 2 });

      // 2. ui/theme.css
      const themeCss = `
:root {
  --primary: #3b82f6;
  --secondary: #1e293b;
  --background: #ffffff;
  --foreground: #0f172a;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: sans-serif;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
}
`;
      await fs.writeFile(path.join(themePath, 'ui/theme.css'), themeCss.trim() + '\n');

      // 3. ui/index.ts
      const uiIndex = `
export const init = () => {
  console.log('[${slug}] Theme UI Initialized');
  
  // Custom theme logic here
  document.body.classList.add('theme-${slug}');
};

// --- Self-Registration ---
if (typeof window !== 'undefined' && (window as any).Fromcode) {
  const Fromcode = (window as any).Fromcode;
  
  // Custom theme scripts can interact with Fromcode bridge here
  init();
}
`;
      await fs.writeFile(path.join(themePath, 'ui/index.ts'), uiIndex.trim() + '\n');

      console.log(chalk.green('\nTheme scaffolded successfully!'));
      console.log(chalk.gray(`Location: ${themePath}`));

    } catch (error) {
      console.error(chalk.red('Error creating theme:'), error);
    }
  });

theme
  .command('list')
  .description('List all local themes')
  .action(async () => {
    try {
      const themesDir = getThemesDir();
      const dirs = await fs.readdir(themesDir);
      console.log(chalk.blue('\nLocal Themes:'));
      console.log(chalk.gray('--------------------------------------------------'));
      
      for (const dir of dirs) {
        if (dir.startsWith('.')) continue;
        const manifestPath = path.join(themesDir, dir, 'theme.json');
        
        if (await fs.pathExists(manifestPath)) {
          const manifest = await fs.readJson(manifestPath);
          console.log(`${chalk.bold(manifest.name)} (${chalk.cyan(manifest.slug || dir)}) v${manifest.version}`);
          console.log(chalk.gray(`  Author: ${manifest.author || 'unknown'}`));
          console.log('');
        }
      }
    } catch (error) {
      console.error(chalk.red('Error listing themes:'), error);
    }
  });

theme
  .command('build <slug>')
  .description('Build theme UI assets')
  .option('-w, --watch', 'Watch for changes', false)
  .action(async (slug, options) => {
    try {
      const themesDir = getThemesDir();
      const themeDir = path.join(themesDir, slug);
      if (!fs.existsSync(themeDir)) {
        console.error(chalk.red(`Theme directory not found: ${themeDir}`));
        return;
      }

      const uiDir = path.join(themeDir, 'ui');
      if (!fs.existsSync(uiDir)) {
        console.log(chalk.yellow(`No ui directory found for theme ${slug}. Skipping build.`));
        return;
      }

      const entryPoints = [
         path.join(uiDir, 'index.ts'),
         path.join(uiDir, 'index.js')
      ].filter(p => fs.existsSync(p));

      if (entryPoints.length === 0) {
        console.error(chalk.red(t('cli.build.no_entry', { dir: uiDir, extra: '' })));
        return;
      }

      const outDir = uiDir;
      await fs.ensureDir(outDir);

      console.log(chalk.blue(t('cli.build.starting', { type: 'theme', slug })));

      // Compile styles first (supports SCSS -> CSS)
      await compileStyles(uiDir);

      let external = ['react', 'react-dom', '@fromcode/react', '@fromcode/admin', '@fromcode/admin/components', 'lucide-react', 'react/jsx-runtime'];
      const themeManifestPath = path.join(themeDir, 'theme.json');
      if (fs.existsSync(themeManifestPath)) {
        try {
          const manifest = await fs.readJson(themeManifestPath);
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
        outfile: path.join(uiDir, 'bundle.js'), // Themes typically expect bundle.js in ui root or dist
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
        console.log(chalk.green('Theme build started in watch mode...'));
      } else {
        await esbuild.build(buildOptions);
        console.log(chalk.green('Theme build completed successfully!'));
      }

    } catch (error) {
      console.error(chalk.red('Error building theme:'), error);
    }
  });

theme
  .command('pack <slug>')
  .description('Pack a theme into a ZIP for the marketplace')
  .action(async (slug) => {
    try {
      const themesDir = getThemesDir();
      const themePath = path.join(themesDir, slug);

      if (!fs.existsSync(themePath)) {
        console.error(chalk.red(`Theme directory not found: ${themePath}`));
        return;
      }

      const manifestPath = path.join(themePath, 'theme.json');
      const manifest = await fs.readJson(manifestPath);
      const version = manifest.version;
      const outDir = path.resolve(process.cwd(), 'dist');
      await fs.ensureDir(outDir);
      
      const zipPath = path.join(outDir, `theme-${slug}-${version}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);
      archive.directory(themePath, false);
      await archive.finalize();

      console.log(chalk.green(`\nTheme packed successfully: ${zipPath}`));
    } catch (error) {
      console.error(chalk.red('Error packing theme:'), error);
    }
  });

theme
  .command('install <slug>')
  .description('Install a theme from the registry')
  .option('-r, --registry <url>', 'Registry URL', process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json')
  .action(async (slug, options) => {
     // Implementation similar to plugin install but for theme
     try {
      console.log(chalk.blue(`\nFetching theme info for ${chalk.bold(slug)}...`));
      const response = await fetch(options.registry);
      const registry = (await response.json()) as Registry;
      const themeInfo = registry.themes?.find((t: ThemeManifest) => t.slug === slug);

      if (!themeInfo) {
        console.error(chalk.red(`Theme not found in registry: ${slug}`));
        return;
      }

      const downloadUrl = (themeInfo.downloadUrl && themeInfo.downloadUrl.startsWith('.'))
        ? new URL(themeInfo.downloadUrl, options.registry).toString()
        : themeInfo.downloadUrl;
      
      if (!downloadUrl) {
        console.error(chalk.red(`No download URL found for theme: ${slug}`));
        return;
      }
      const zipResponse = await fetch(downloadUrl);
      const tmpZip = path.resolve(process.cwd(), `tmp-theme-${slug}.zip`);
      const fileStream = fs.createWriteStream(tmpZip);
      
      if (!zipResponse.body) throw new Error('Empty response body');
      await pipeline(zipResponse.body as unknown as Readable, fileStream);

      const themesDir = getThemesDir();
      const targetDir = path.join(themesDir, slug);
      if (fs.existsSync(targetDir)) await fs.remove(targetDir);
      
      await fs.ensureDir(targetDir);
      await extract(tmpZip, { dir: targetDir });
      await fs.remove(tmpZip);
      
      console.log(chalk.green(`\nTheme ${chalk.bold(slug)} installed successfully!`));
    } catch (error) {
      console.error(chalk.red('Error installing theme:'), error);
    }
  });

program
  .command('dev')
  .description('Start the development server')
  .action(async () => {
    try {
      console.log(chalk.blue('\nStarting fromcode development environment...'));
      
      // Check for docker-compose.yml
      if (fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))) {
        console.log(chalk.gray('Spinning up infrastructure (Docker)...'));
        const docker = spawn('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
        await new Promise((resolve) => docker.on('exit', resolve));
      }

      console.log(chalk.gray('Starting services...'));
      
      // In a real implementation, we would use a more sophisticated runner like concurrently
      // For now, let's run npm run dev if it exists in package.json
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        if (pkg.scripts?.dev) {
          const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
          dev.on('exit', (code) => {
            process.exit(code || 0);
          });
        } else {
             console.log(chalk.yellow('No dev script found in package.json. Starting default framework dev...'));
             // Default framework dev logic here
        }
      }
    } catch (error) {
      console.error(chalk.red('Error starting development server:'), error);
    }
  });

program
  .command('build')
  .description('Build the project for production')
  .option('-m, --mode <mode>', 'Build mode (full, api, admin, frontend)', 'full')
  .action(async (options) => {
    try {
      console.log(chalk.blue(`\nBuilding fromcode project [Mode: ${options.mode}]...`));
      
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        const buildScript = pkg.scripts?.[`build:${options.mode}`] || pkg.scripts?.build;
        if (buildScript) {
          const build = spawn('npm', ['run', options.mode === 'full' ? 'build' : `build:${options.mode}`], { stdio: 'inherit', shell: true });
          await new Promise((resolve) => build.on('exit', resolve));
        }
      }
      
      console.log(chalk.green('\nBuild completed successfully!'));
    } catch (error) {
      console.error(chalk.red('Error building project:'), error);
    }
  });

program
  .command('create <name>')
  .description('Create a new fromcode project')
  .option('-t, --template <template>', 'Starter template to use', 'minimal')
  .action(async (name, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), name);
      if (fs.existsSync(targetDir)) {
        console.error(chalk.red(`Directory already exists: ${targetDir}`));
        return;
      }

      console.log(chalk.blue(`\nCreating new fromcode project: ${chalk.bold(name)}...`));
      console.log(chalk.gray(`Template: ${options.template}`));

      const starterPath = path.resolve(__dirname, '..', '..', '..', 'starters', options.template);
      
      if (!fs.existsSync(starterPath)) {
        console.error(chalk.red(`Template not found: ${options.template}`));
        console.log(chalk.gray(`Checked path: ${starterPath}`));
        return;
      }

      await fs.copy(starterPath, targetDir);
      
      // Customize package.json
      const packageJsonPath = path.join(targetDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        packageJson.name = name;
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      }

      console.log(chalk.green(`\nProject created successfully in ${targetDir}!`));
      console.log(chalk.white(`\nNext steps:`));
      console.log(chalk.cyan(`  cd ${name}`));
      console.log(chalk.cyan(`  npm install`));
      console.log(chalk.cyan(`  npm run dev`));

    } catch (error) {
      console.error(chalk.red('Error creating project:'), error);
    }
  });

program
  .command('docker:build')
  .description('Build framework Docker images')
  .option('-m, --mode <mode>', 'Deployment mode (api-only, api-admin, full-stack, frontend-only)', 'full-stack')
  .action((options) => {
    console.log(chalk.blue(`Building Docker image for mode: ${options.mode}...`));
    // In a real implementation, this would trigger docker build with --target
    console.log(chalk.gray(`docker build --target ${options.mode} -t fromcode-framework:${options.mode} .`));
  });

program
  .command('docker:deploy')
  .description('Deploy framework using Docker Compose')
  .action(() => {
    console.log(chalk.blue('Deploying with Docker Compose...'));
    console.log(chalk.gray('docker-compose up -d'));
  });

program.parse(process.argv);
