import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PluginSuccessionService } from '@core/plugin/services/installation/plugin-succession-service';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';

type Row = Record<string, any>;

/** Just enough of a database for the hand-over: tables of rows, matched on every key of `where`. */
class FakeDatabase {
  tables: Record<string, Row[]> = {};
  renamed: Array<[string, string]> = [];
  private matches = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => row[key] === value);
  rows = (table: string) => (this.tables[table] ??= []);
  async find(table: string, options: { where?: Row; search?: { columns: string[]; value: string } } = {}) {
    return this.rows(table).filter((row) => this.matches(row, options.where)
      && (!options.search || options.search.columns.some((column) => String(row[column] ?? '').includes(options.search!.value))));
  }
  async findOne(table: string, where: Row) { return this.rows(table).find((row) => this.matches(row, where)) ?? null; }
  async update(table: string, where: Row, data: Row) { for (const row of this.rows(table)) if (this.matches(row, where)) Object.assign(row, data); }
  async delete(table: string, where: Row) { this.tables[table] = this.rows(table).filter((row) => !this.matches(row, where)); return true; }
  async getTables() { return Object.keys(this.tables).filter((name) => name.startsWith('fcp_')); }
  async renameTable(from: string, to: string) { this.tables[to] = this.rows(from); delete this.tables[from]; this.renamed.push([from, to]); }
  async withExclusiveLock<T>(_name: string, fn: () => Promise<T>) { return fn(); }
  async withTenant<T>(_tenant: string, fn: () => Promise<T>) { return fn(); }
  async withPlatformAdmin<T>(fn: () => Promise<T>) { return fn(); }
}

const manifest = (extra: Partial<IPluginManifest> = {}) => ({ slug: 'zen-myself', name: 'Zen Myself', version: '0.2.0', ...extra }) as IPluginManifest;

/** A plugin root holding the old plugin (naming its successor, unless `handsOver` is false) and the new one. */
const root = (handsOver = true): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'succession-'));
  const write = (name: string, body: object) => {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'manifest.json'), JSON.stringify(body));
  };
  write('affirmations', handsOver ? { slug: 'affirmations', replacedBy: 'zen-myself' } : { slug: 'affirmations' });
  write('zen-myself', { slug: 'zen-myself' });
  return path.join(dir, 'zen-myself');
};

const seeded = () => {
  const db = new FakeDatabase();
  db.rows('_system_plugins').push({ slug: 'affirmations', version: '0.1.44', state: 'active' }, { slug: 'affirmations-extra', version: '1.0.0' });
  db.rows('fcp_affirmations_topics').push({ id: 1 }, { id: 2 });
  db.rows('fcp_affirmations_profiles').push({ id: 7 });
  db.rows('fcp_affirmations_extra_notes').push({ id: 9 });
  db.rows('_system_plugin_settings').push({ plugin_slug: 'affirmations', tenant_id: 'site', settings: { adsEnabled: true } });
  db.rows('_system_tenant_plugins').push({ plugin_slug: 'affirmations', tenant_id: 'site' });
  db.rows('_system_migrations').push({ name: 'plugin:affirmations:001_init' }, { name: '064_core' });
  db.rows('_system_roles').push({ id: 1, permissions: ['affirmations:manage', 'cms:manage'] });
  db.rows('_system_site_roles').push({ id: 2, permissions: ['affirmations:topics:read'] });
  db.rows('_system_meta').push({ key: 'entity_schema:fcp_affirmations_topics' });
  return db;
};

describe('a renamed plugin taking over', () => {
  it('moves the tables, registry, settings, sites, ledger and permissions to the new name', async () => {
    const db = seeded();
    expect(await new PluginSuccessionService(db as never).adopt(manifest(), root())).toEqual(['affirmations']);
    expect(db.rows('fcp_zen_myself_topics')).toHaveLength(2);
    expect(db.rows('fcp_zen_myself_profiles')).toHaveLength(1);
    // Another plugin whose slug only begins like the old one keeps its table.
    expect(db.rows('fcp_affirmations_extra_notes')).toHaveLength(1);
    expect(db.rows('_system_plugins').map((row) => row.slug).sort()).toEqual(['affirmations-extra', 'zen-myself']);
    expect(db.rows('_system_plugin_settings')[0]).toMatchObject({ plugin_slug: 'zen-myself', settings: { adsEnabled: true } });
    expect(db.rows('_system_tenant_plugins')[0].plugin_slug).toBe('zen-myself');
    expect(db.rows('_system_migrations').map((row) => row.name)).toEqual(['plugin:zen-myself:001_init', '064_core']);
    expect(db.rows('_system_roles')[0].permissions).toEqual(['zen-myself:manage', 'cms:manage']);
    expect(db.rows('_system_site_roles')[0].permissions).toEqual(['zen-myself:topics:read']);
    expect(db.rows('_system_meta')[0].key).toBe('entity_schema:fcp_zen_myself_topics');
  });

  it('replaces the placeholder row sandbox staging writes for the new name, keeping the old row', async () => {
    const db = seeded();
    db.rows('_system_plugins').push({ slug: 'zen-myself', isolation_uid: 20005 });
    await new PluginSuccessionService(db as never).adopt(manifest(), root());
    expect(db.rows('_system_plugins').filter((row) => row.slug === 'zen-myself')).toEqual([{ slug: 'zen-myself', version: '0.1.44', state: 'active' }]);
  });

  it('does nothing once the new name is installed, or when the old one never was', async () => {
    const installed = seeded();
    installed.rows('_system_plugins').push({ slug: 'zen-myself', version: '0.2.0' });
    expect(await new PluginSuccessionService(installed as never).adopt(manifest(), root())).toEqual([]);
    expect(installed.renamed).toEqual([]);

    const fresh = new FakeDatabase();
    expect(await new PluginSuccessionService(fresh as never).adopt(manifest(), root())).toEqual([]);
    // The old plugin never named a successor: a new plugin cannot claim its data.
    expect(await new PluginSuccessionService(seeded() as never).adopt(manifest(), root(false))).toEqual([]);
  });

  it('never takes over a plugin another owner installed', async () => {
    const platform = seeded();
    const siteUpload = manifest({ ownerTenantId: 'site-a' } as Partial<IPluginManifest>);
    expect(await new PluginSuccessionService(platform as never).adopt(siteUpload, root())).toEqual([]);
    expect(platform.renamed).toEqual([]);
    expect(platform.rows('_system_plugins').map((row) => row.slug)).toContain('affirmations');

    const site = seeded();
    site.rows('_system_plugins')[0].owner_tenant_id = 'site-a';
    expect(await new PluginSuccessionService(site as never).adopt(manifest(), root())).toEqual([]);
    expect(await new PluginSuccessionService(site as never).adopt(siteUpload, root())).toEqual(['affirmations']);
  });

  it('stops a running plugin of the old name before moving its tables', async () => {
    const order: string[] = [];
    const db = seeded();
    const rename = db.renameTable.bind(db);
    db.renameTable = async (from, to) => { order.push('rename'); return rename(from, to); };
    await new PluginSuccessionService(db as never, async (slug) => { order.push(`retire:${slug}`); }).adopt(manifest(), root());
    expect(order[0]).toBe('retire:affirmations');
  });

  it('hides an old plugin only once the successor it names is installed beside it', () => {
    const rootDir = path.dirname(root());
    expect([...PluginSuccessionService.replacedOnDisk(rootDir)]).toEqual(['affirmations']);
    fs.rmSync(path.join(rootDir, 'zen-myself'), { recursive: true, force: true });
    expect([...PluginSuccessionService.replacedOnDisk(rootDir)]).toEqual([]);
    expect([...PluginSuccessionService.replacedOnDisk(path.join(rootDir, 'missing'))]).toEqual([]);
  });

  it('finishes the hand-over when the data folder cannot be moved', async () => {
    const db = seeded();
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('EACCES: permission denied'); });
    const exists = vi.spyOn(fs, 'existsSync').mockImplementation((target) => String(target).endsWith(`${path.sep}affirmations`));
    try {
      expect(await new PluginSuccessionService(db as never).adopt(manifest(), root())).toEqual(['affirmations']);
      expect(db.rows('_system_plugins').map((row) => row.slug)).toContain('zen-myself');
    } finally {
      rename.mockRestore();
      exists.mockRestore();
    }
  });
});
