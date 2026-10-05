import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PluginMigrationOptInGuard } from '../src/plugin-migration-opt-in-guard';

/** Both directions against a real tree: a guard that cannot fail is worth nothing. */
describe('PluginMigrationOptInGuard', () => {
  const made: string[] = [];

  const plugin = (manifest: Record<string, unknown>, files: Record<string, string>): void => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-guard-'));
    made.push(root);
    const dir = path.join(root, 'plugins', 'billing');
    fs.mkdirSync(path.join(dir, 'src', 'migrations'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'billing', ...manifest }));
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
    vi.stubEnv('PLUGINS_DIR', path.join(root, 'plugins'));
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fails on a migration file the plugin never opted in to', () => {
    plugin({}, { 'src/migrations/2026-01-01-add-note.ts': 'export class AddNote {}' });
    expect(PluginMigrationOptInGuard.run()).toBe(1);
  });

  it('passes once the manifest opts in', () => {
    plugin({ migrations: 'dist/migrations' }, { 'src/migrations/2026-01-01-add-note.ts': 'export class AddNote {}' });
    expect(PluginMigrationOptInGuard.run()).toBe(0);
  });

  it('passes a migration the plugin runs itself, but not one only a test imports', () => {
    plugin({}, {
      'src/migrations/2026-01-01-add-note.ts': 'export class AddNote {}',
      'src/on-init.ts': "import { AddNote } from '@plugin/src/migrations/2026-01-01-add-note';",
    });
    expect(PluginMigrationOptInGuard.run()).toBe(0);

    plugin({}, {
      'src/migrations/2026-01-01-add-note.ts': 'export class AddNote {}',
      'tests/add-note.test.ts': "import { AddNote } from '@plugin/src/migrations/2026-01-01-add-note';",
    });
    expect(PluginMigrationOptInGuard.run()).toBe(1);
  });
});
