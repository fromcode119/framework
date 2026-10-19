import { describe, expect, it } from 'vitest';
import { PluginPlatformClaims } from '@core/plugin/platform/plugin-platform-claims';

/** An in-memory claims table with the real table's unique (plugin, key) index. */
class ClaimsTable {
  rows: Array<Record<string, any>> = [];
  private matches = (row: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([k, v]) => row[k] === v);
  async findOne(_table: string, where: Record<string, any>) { return this.rows.find((row) => this.matches(row, where)) ?? null; }
  async find(_table: string, query: { where: Record<string, any> }) { return this.rows.filter((row) => this.matches(row, query.where)); }
  async insert(_table: string, row: Record<string, any>) {
    if (this.rows.some((r) => r.plugin_slug === row.plugin_slug && r.claim_key === row.claim_key)) throw new Error('unique violation');
    this.rows.push(row);
    return row;
  }
  async delete(_table: string, where: Record<string, any>) { this.rows = this.rows.filter((row) => !this.matches(row, where)); }
}

/** One key, one owner: a site can never take over an account another site connected. */
describe('PluginPlatformClaims', () => {
  const setup = () => {
    const table = new ClaimsTable();
    return { table, claims: new PluginPlatformClaims(table as any) };
  };

  it('grants a free key and records its owner', async () => {
    const { claims } = setup();
    expect(await claims.claim('replies', '1', ['page-a'])).toEqual({ granted: ['page-a'], refused: [] });
    expect(await claims.ownerOf('replies', 'page-a')).toEqual({ tenantId: '1' });
  });

  it('refuses a key another site owns and leaves it with that site', async () => {
    const { claims } = setup();
    await claims.claim('replies', '1', ['page-a']);
    expect(await claims.claim('replies', '2', ['page-a', 'page-b'])).toEqual({ granted: ['page-b'], refused: ['page-a'] });
    expect(await claims.ownerOf('replies', 'page-a')).toEqual({ tenantId: '1' });
  });

  it('grants again a key the same site already owns', async () => {
    const { claims } = setup();
    await claims.claim('replies', '1', ['page-a']);
    expect(await claims.claim('replies', '1', ['page-a'])).toEqual({ granted: ['page-a'], refused: [] });
  });

  it('keeps each plugin\'s keys apart', async () => {
    const { claims } = setup();
    await claims.claim('replies', '1', ['page-a']);
    expect(await claims.claim('other', '2', ['page-a'])).toEqual({ granted: ['page-a'], refused: [] });
  });

  it('ignores blank and repeated keys', async () => {
    const { claims } = setup();
    expect(await claims.claim('replies', '1', [' page-a ', 'page-a', '', '  '])).toEqual({ granted: ['page-a'], refused: [] });
  });

  it('lets a site release only its own keys, after which another may claim them', async () => {
    const { claims } = setup();
    await claims.claim('replies', '1', ['page-a']);
    await claims.claim('replies', '2', ['page-b']);
    expect(await claims.release('replies', '2', ['page-a'])).toBe(0);
    expect(await claims.ownerOf('replies', 'page-a')).toEqual({ tenantId: '1' });
    expect(await claims.release('replies', '1')).toBe(1);
    expect(await claims.claim('replies', '2', ['page-a'])).toEqual({ granted: ['page-a'], refused: [] });
    expect((await claims.keysOf('replies', '2')).sort()).toEqual(['page-a', 'page-b']);
  });

  it('settles a lost race in favour of the winner', async () => {
    const { table, claims } = setup();
    const original = table.findOne.bind(table);
    let first = true;
    // The first lookup misses; another site inserts the key before this insert lands.
    table.findOne = async (t: string, where: Record<string, any>) => {
      if (first) { first = false; table.rows.push({ plugin_slug: 'replies', claim_key: 'page-a', tenant_id: '9' }); return null; }
      return original(t, where);
    };
    expect(await claims.claim('replies', '1', ['page-a'])).toEqual({ granted: [], refused: ['page-a'] });
  });
});
