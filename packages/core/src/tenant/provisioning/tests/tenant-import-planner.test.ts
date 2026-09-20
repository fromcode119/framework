import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';
import type { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportPlanner } from '@core/tenant/provisioning/tenant-import-planner';
import type { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

function fakeRegistry(): TenantRegistryService {
  return { assertAvailable: vi.fn(async () => undefined) } as unknown as TenantRegistryService;
}

/**
 * `pluginSlugs` backs `TenantInstalledPluginSlugs.read` — the same `_system_plugins` table the
 * executor's rowFilter reads, never the plugin host's in-memory loaded set.
 */
function fakeDb(pluginSlugs: string[] = []): IDatabaseManager {
  return {
    findOne: vi.fn(async () => null),
    queryRaw: vi.fn(async (sql: string) => {
      if (sql.includes(`FROM "${SystemConstants.TABLE.PLUGINS}"`)) return pluginSlugs.map((slug) => ({ slug }));
      return [];
    }),
  } as unknown as IDatabaseManager;
}

function fakeReader(manifest: TenantArchiveManifest, rowsByTable: Record<string, Array<Record<string, unknown>>> = {}): TenantArchiveReader {
  return {
    manifest,
    rows: async function* rows(table: string) { for (const row of rowsByTable[table] ?? []) yield row; },
    users: async function* users() { /* none */ },
    fileNames: () => [],
    filePath: () => null,
    close: () => undefined,
  } as unknown as TenantArchiveReader;
}

function manifestWith(
  tables: Array<{ name: string; rows: number; columns: string[]; hasSerialId: boolean }>,
  warnings: string[],
  plugins: Array<{ slug: string; version: string }> = [],
): TenantArchiveManifest {
  return new TenantArchiveManifest(
    1, '2026-01-01T00:00:00.000Z', '0.0.0', 'tenant',
    { id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', hostAliases: [], state: 'active', kind: 'site', appearance: '' },
    plugins, null,
    tables,
    0, { count: 0, bytes: 0 }, warnings,
  );
}

describe('TenantImportPlanner.plan — export warnings vs. decision warnings', () => {
  it('keeps a manifest export warning out of `warnings`, unprefixed, in the new `exportWarnings`', async () => {
    const manifest = manifestWith([], ['written at export time, describes the archive']);
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.exportWarnings).toEqual(['written at export time, describes the archive']);
    expect(plan.warnings.some((w) => w.startsWith('Export warning:'))).toBe(false);
    expect(plan.warnings).not.toContain('written at export time, describes the archive');
  });
});

describe('TenantImportPlanner.plan — pluginSlug and label pass through onto plan.tables', () => {
  it('carries the destination descriptor\'s pluginSlug/label for a table this platform has', async () => {
    const destination = new TenantTableDescriptor('fcp_alpha_orders', { id: 'text' }, false, null, [], new Set(), 'alpha', 'Orders');
    const manifest = manifestWith([{ name: 'fcp_alpha_orders', rows: 0, columns: ['id'], hasSerialId: false }], []);
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [destination], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].pluginSlug).toBe('alpha');
    expect(plan.tables[0].label).toBe('Orders');
  });

  it('recovers pluginSlug from the physical name alone for a SKIPPED table, with label left null', async () => {
    const manifest = manifestWith([{ name: 'fcp_beta_widgets', rows: 3, columns: ['id'], hasSerialId: true }], []);
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].pluginSlug).toBe('beta');
    expect(plan.tables[0].label).toBeNull();
  });

  it('longest-prefix-matches a multi-token, HYPHENATED plugin slug against the archive\'s own plugins, instead of truncating at the first underscore', async () => {
    // "alpha" is ALSO a real, single-token slug here — the naive `PhysicalTableNameUtils.parse`
    // split would answer it for "fcp_alpha_beta_widgets" too. Real plugin slugs are hyphenated
    // (`alpha-beta`), while the physical table name is always snake-cased
    // (`NamingStrategy.toSnakeIdentifier`) — only comparing the SNAKE form of each known slug lets
    // the longer, correct match ("alpha-beta") win, and the resolver must hand back the slug in its
    // original (hyphenated) spelling, not the snake form.
    const manifest = manifestWith(
      [{ name: 'fcp_alpha_beta_widgets', rows: 5, columns: ['id'], hasSerialId: true }],
      [],
      [{ slug: 'alpha', version: '1.0.0' }, { slug: 'alpha-beta', version: '1.0.0' }],
    );
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].pluginSlug).toBe('alpha-beta');
  });

  it('answers null, never a guess, when no real plugin slug is a matching prefix', async () => {
    const manifest = manifestWith(
      [{ name: 'fcp_gamma_delta_widgets', rows: 2, columns: ['id'], hasSerialId: true }],
      [],
      [{ slug: 'alpha', version: '1.0.0' }],
    );
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.tables[0].pluginSlug).toBeNull();
  });
});

describe('TenantImportPlanner.plan — runtime-only exclusions counted at plan time', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts _system_meta rows the executor will drop for being a platform key, and _system_plugin_settings rows for an uninstalled plugin', async () => {
    vi.spyOn(TenantBespokePolicies, 'platformKeys').mockReturnValue(['deployment_secret']);

    const metaTable = new TenantTableDescriptor(SystemConstants.TABLE.META, { id: 'text', key: 'text', value: 'text' }, false, null, []);
    const pluginSettingsTable = new TenantTableDescriptor(SystemConstants.TABLE.PLUGIN_SETTINGS, { id: 'text', plugin_slug: 'text', value: 'text' }, false, null, []);

    const manifest = manifestWith(
      [
        { name: SystemConstants.TABLE.META, rows: 2, columns: ['id', 'key', 'value'], hasSerialId: false },
        { name: SystemConstants.TABLE.PLUGIN_SETTINGS, rows: 2, columns: ['id', 'plugin_slug', 'value'], hasSerialId: false },
      ],
      [],
    );
    const reader = fakeReader(manifest, {
      [SystemConstants.TABLE.META]: [{ id: 1, key: 'deployment_secret', value: 'x' }, { id: 2, key: 'shop_name', value: 'y' }],
      [SystemConstants.TABLE.PLUGIN_SETTINGS]: [{ id: 1, plugin_slug: 'alpha', value: 'x' }, { id: 2, plugin_slug: 'beta', value: 'y' }],
    });
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    // "alpha" is installed per `_system_plugins` (the table the executor's rowFilter itself reads);
    // `installed.plugins` is left EMPTY on purpose, to prove the exclusion count no longer reads it.
    const installed = { plugins: new Map(), themes: new Map() };
    const plan = await new TenantImportPlanner(fakeDb(['alpha']), fakeRegistry(), [metaTable, pluginSettingsTable], installed, '/tmp/fc-planner-test-uploads').plan(reader, identity);

    expect(plan.metaRowsExcluded).toBe(1);
    expect(plan.pluginSettingsRowsExcluded).toBe(1);
  });

  it('counts nothing when the tables are absent, empty, or skipped', async () => {
    const manifest = manifestWith([], []);
    const identity = TenantIdentity.from({ id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', kind: 'site' });
    const plan = await new TenantImportPlanner(fakeDb(), fakeRegistry(), [], { plugins: new Map(), themes: new Map() }, '/tmp/fc-planner-test-uploads').plan(fakeReader(manifest), identity);

    expect(plan.metaRowsExcluded).toBe(0);
    expect(plan.pluginSettingsRowsExcluded).toBe(0);
  });
});

/**
 * Which id path a table takes, and WHY.
 *
 * An import used to renumber whenever the archive's ids overlapped what this platform had handed
 * out, because every site's rows shared one key on `id` alone. Renumbering forces every reference to
 * be rewritten, and that is only correct while the catalog of references is complete — twice it was
 * not, and rows ended up holding numbers that belonged to another site's records.
 *
 * Migration 049 widens the key to `(tenant_id, id)`, which removes the collision and therefore the
 * reason to renumber. The decision is read from the LIVE catalog rather than assumed from the
 * migration having run: it widens the tables that are tenant-scoped and carry row-level security,
 * which is most of them and not all of them, and a table it left alone still shares one pool of
 * numbers. These tests are about the two paths staying honest about which one a table is on.
 *
 * Each test uses its own table name because the answer is cached per table for the process — a
 * property the planner and executor rely on to reach the same decision from the same inputs.
 */
describe('TenantImportPlanner.decideIds', () => {
  /** A platform that has handed out `taken` ids, and whose key for `table` is or is not per-tenant. */
  const platform = (taken: number, keyedPerTenant: boolean, isCalled = true): IDatabaseManager => ({
    // Asked through the DRIVER, not as SQL text: the catalog query is Postgres-only and lives in the
    // dialect that owns it, which is why this fakes a capability rather than a statement.
    supportsTenantIsolation: () => true,
    tenantIsolation: { keysPerTenant: vi.fn(async () => keyedPerTenant) },
    queryRaw: vi.fn(async (sql: string) => {
      if (sql.includes('last_value')) return [{ last_value: taken, is_called: isCalled }];
      return [];
    }),
  } as unknown as IDatabaseManager);

  const descriptor = (name: string) => new TenantTableDescriptor(name, { id: 'integer' }, true, `${name}_id_seq`, []);

  const archive = (name: string, ids: number[]) => fakeReader(
    manifestWith([{ name, rows: ids.length, columns: ['id'], hasSerialId: true }], []),
    { [name]: ids.map((id) => ({ id })) },
  );

  it('keeps the archive ids when the table gives each site its own id space', async () => {
    const name = 'fcp_a_orders';
    const decision = await TenantImportPlanner.decideIds(platform(1204, true), descriptor(name), archive(name, [157, 158]));

    expect(String(decision.mode.value)).toBe('preserve');
    expect(decision.basis).toBe('perTenantKey');
    // Still measured and still reported, even though they no longer decide anything: they are what
    // the operator is shown, and a number that stops being gathered is one nobody notices going wrong.
    expect(decision.minId).toBe(157);
    expect(decision.taken).toBe(1204);
  });

  /**
   * The case that used to be the ONLY safe way to keep ids, and still is wherever the key was not
   * widened: the ranges simply do not touch.
   */
  it('keeps them on a shared key too, when every arriving id sits above what this platform handed out', async () => {
    const name = 'fcp_b_orders';
    const decision = await TenantImportPlanner.decideIds(platform(100, false), descriptor(name), archive(name, [157, 158]));

    expect(String(decision.mode.value)).toBe('preserve');
    expect(decision.basis).toBe('aboveSequence');
  });

  /**
   * The expensive path, kept reachable ON PURPOSE. A table the migration did not widen shares one
   * pool of numbers with every other site, so an overlapping archive still has to be renumbered —
   * silently preserving there would write this site's rows over somebody else's ids.
   */
  it('renumbers when the key is still shared and the ranges overlap', async () => {
    const name = 'fcp_c_orders';
    const decision = await TenantImportPlanner.decideIds(platform(1204, false), descriptor(name), archive(name, [157, 158]));

    expect(String(decision.mode.value)).toBe('remap');
    expect(decision.basis).toBe('belowSequence');
  });

  /** Nothing numeric arrived, so neither key shape has anything to say about it. */
  it('has nothing to decide when no row carries a numeric id', async () => {
    const name = 'fcp_d_orders';
    const decision = await TenantImportPlanner.decideIds(platform(1204, false), descriptor(name), archive(name, []));

    expect(String(decision.mode.value)).toBe('preserve');
    expect(decision.basis).toBe('empty');
    expect(decision.minId).toBeNull();
  });

  /**
   * A sequence that has never been called holds `last_value = 1` and `is_called = false` — it has
   * handed out NOTHING. Reading that `1` as "one id taken" would renumber an archive starting at 1
   * against an empty platform.
   */
  it('reads an untouched sequence as nothing handed out, not as one', async () => {
    const name = 'fcp_e_orders';
    const decision = await TenantImportPlanner.decideIds(platform(1, false, false), descriptor(name), archive(name, [1, 2]));

    expect(decision.taken).toBe(0);
    expect(String(decision.mode.value)).toBe('preserve');
    expect(decision.basis).toBe('aboveSequence');
  });
});
