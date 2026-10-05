/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * A plugin migration that can never run.
 *
 * A plugin's `src/migrations/*.ts` compile and run at install or update only when its manifest opts in
 * with `"migrations": "dist/migrations"`. Without that key nothing says the files are dead: they are
 * written, reviewed and merged, and never execute — 117 of them, across 15 plugins, before this guard.
 * The data change a migration exists to carry is then silently skipped on every site.
 *
 * A file passes when the manifest opts in, or when the plugin's own code runs it (a plugin may hand a
 * list of migration classes to `context.migrations.run` itself, at boot).
 */
export class PluginMigrationOptInGuard {
  static run(): number {
    const pluginsRoot = ExtensionTrees.dir('plugins');
    if (!pluginsRoot) return 0;
    const offenders: string[] = [];

    for (const pluginDir of PluginMigrationOptInGuard.plugins(pluginsRoot)) {
      const migrationsDir = path.join(pluginDir, 'src', 'migrations');
      const files = PluginMigrationOptInGuard.migrationFiles(migrationsDir);
      if (!files.length || PluginMigrationOptInGuard.optsIn(pluginDir)) continue;
      const code = PluginMigrationOptInGuard.pluginCode(pluginDir, migrationsDir);
      for (const file of files) {
        const name = path.basename(file, path.extname(file));
        if (!code.some((text) => text.includes(`migrations/${name}'`) || text.includes(`migrations/${name}"`))) {
          offenders.push(ExtensionTrees.show(file));
        }
      }
    }

    console.log('Plugin migrations that can never run (no "migrations" opt-in, not run by the plugin):');
    console.log(`  files: ${offenders.length}`);
    if (!offenders.length) {
      console.log('\nPlugin migration opt-in guard passed.');
      return 0;
    }
    console.log('');
    for (const file of offenders) console.log(`  ${file}`);
    console.log(
      '\nThese never compile and never run. Opt the plugin in with "migrations": "dist/migrations" in its'
      + '\nmanifest so they run at the next install or update, or delete the ones whose work is already done.',
    );
    return 1;
  }

  /** Each plugin directory: the scoped one, or every directory under the plugins tree holding a manifest. */
  private static plugins(pluginsRoot: string): string[] {
    if (fs.existsSync(path.join(pluginsRoot, 'manifest.json'))) return [pluginsRoot];
    return fs.readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => path.join(pluginsRoot, entry.name))
      .filter((dir) => fs.existsSync(path.join(dir, 'manifest.json')));
  }

  private static migrationFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((name) => /\.ts$/.test(name) && !name.endsWith('.d.ts'))
      .map((name) => path.join(dir, name));
  }

  private static optsIn(pluginDir: string): boolean {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf8'));
      return String(manifest?.migrations ?? '').trim().length > 0;
    } catch {
      return false;
    }
  }

  /** The text of the plugin's own source, outside its migrations and tests. */
  private static pluginCode(pluginDir: string, migrationsDir: string): string[] {
    const texts: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', 'tests', 'test', '.git'].includes(entry.name) || full === migrationsDir) continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          texts.push(fs.readFileSync(full, 'utf8'));
        }
      }
    };
    walk(pluginDir);
    return texts;
  }
}
