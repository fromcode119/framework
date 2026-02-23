import path from 'path';
import fs from 'fs-extra';
import * as readline from 'readline';
import chalk from 'chalk';
import { DatabaseFactory, DatabaseManager } from '@fromcode119/database';
import { DiscoveryService, MarketplaceCatalogService, getProjectRoot as getFrameworkProjectRoot, getPluginsDir as getFrameworkPluginsDir, getThemesDir as getFrameworkThemesDir } from '@fromcode119/core';
import { MarketplaceClient } from '@fromcode119/marketplace-client';

export function getProjectRoot(): string {
  return getFrameworkProjectRoot();
}

export function getPluginsDir(): string {
  const dir = getFrameworkPluginsDir();
  if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
  return dir;
}

export function getThemesDir(): string {
  const dir = getFrameworkThemesDir();
  if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
  return dir;
}

export async function ask(question: string): Promise<string> {
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

export async function getDatabase(): Promise<DatabaseManager> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not defined. Please check your .env file.');
  }
  const db = DatabaseFactory.create(url);
  await db.connect();
  return db;
}

export function getMarketplace(): MarketplaceCatalogService {
  const pluginsDir = getPluginsDir();
  const root = getProjectRoot();
  const discovery = new DiscoveryService(pluginsDir, root);
  return new MarketplaceCatalogService(discovery);
}

export function getMarketplaceClient(): MarketplaceClient {
  return new MarketplaceClient();
}

const translations = {
  en: {
    'cli.status.checking': 'Checking marketplace at {{registry}}...',
    'cli.status.no_core': 'Marketplace does not provide core version information yet.',
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
export function t(key: string, params: Record<string, string> = {}, defaultValue?: string): string {
  let text = (translations as any)[currentLocale][key] || defaultValue || key;
  Object.keys(params).forEach(p => {
    text = text.replace(`{{${p}}}`, params[p]);
  });
  return text;
}

export async function compileStyles(uiDir: string): Promise<void> {
  const sass = require('sass');
  const less = require('less');
  
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
