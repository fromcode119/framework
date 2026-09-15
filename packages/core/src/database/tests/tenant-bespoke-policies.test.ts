import { describe, expect, it } from 'vitest';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * What core DECLARES. The statements a driver renders from these specs are asserted beside the SQL,
 * in `packages/database/src/dialects/postgres/tests/tenant-bespoke-policy-sql.test.ts` — core no
 * longer writes policy text, so a SQL assertion here would be testing the wrong layer.
 */
describe('TenantBespokePolicies', () => {
  const specs = TenantBespokePolicies.specs();
  const specFor = (table: string) => specs.find((spec) => spec.table === table);

  /**
   * THE GUARD FOR THE BUG THIS LIST INVITES.
   *
   * Every key `PlatformSettingsService` reads is read from the PLATFORM row. If such a key is not
   * declared here, the settings controller files the WRITE under whichever tenant the request
   * carried, and the read never finds it — the control saves successfully and changes nothing.
   * That shipped for `admin_search_indexing` (the console and api indexing toggle had never once
   * taken effect) and for `framework_repository` and `sources_workspace_root`, which are read by
   * untenanted boot code. It fails closed, which is why none of them were noticed.
   *
   * Scope is currently an omission from a hand-written array, so nothing but this relates the list
   * to its readers.
   */
  it('derives its platform keys from the registry, and every one reaches the SQL', () => {
    const platformKeys = TenantBespokePolicies.platformKeys();

    expect(platformKeys).toEqual(SystemSettingRegistry.platformKeys());
    // An empty list compiles to `IN ()`, which would make every deployment truth invisible to every
    // tenant — `marketplace_url`, `maintenance_mode`, `setup_completed` included.
    expect(platformKeys.length).toBeGreaterThan(0);

    // And the spec must actually CARRY them to the driver: declaring the keys somewhere the policy
    // never sees is the same silent failure as not declaring them at all.
    const meta = specFor('_system_meta');
    expect(meta?.kind).toBe('platform-keys-visible');
    expect(meta?.kind === 'platform-keys-visible' && meta.platformKeys).toEqual(platformKeys);
  });

  it('declares media as SHARED-READ, which is what earns it four per-command policies', () => {
    // A single `USING (own OR shared) WITH CHECK (own)` would let a borrower DELETE another
    // tenant's shared asset: DELETE falls back to USING. Sharing must widen reads and nothing else.
    // That the driver splits it into four is asserted in the dialect's own test.
    const media = specFor('media');
    expect(media?.kind).toBe('shared-read');
    expect(media?.kind === 'shared-read' && media.sharedColumn).toBe('shared');
  });

  it('declares the settings key column, without which the policy cannot name the platform keys', () => {
    const meta = specFor('_system_meta');
    expect(meta?.kind === 'platform-keys-visible' && meta.keyColumn).toBe('key');
  });

  it('declares every journal table, and a journal is NOT the generic rule', () => {
    // These were GLOBAL: a site administrator saw every action and log line from every other
    // customer's site. Their `_system_` prefix is the only reason the generic sweep skipped them,
    // and a journal is a tenant's own record, not platform configuration.
    for (const table of ['_system_audit_logs', '_system_logs', '_system_record_versions']) {
      expect(specFor(table)?.kind).toBe('journal');
    }
  });

  it('declares plugin settings as per-tenant — a plugin\'s configuration is never platform-level', () => {
    expect(specFor('_system_plugin_settings')?.kind).toBe('tenant-settings');
  });

  it('tables() names exactly what it declares, so the generic sweep skips exactly these', () => {
    expect(TenantBespokePolicies.tables()).toEqual(specs.map((spec) => spec.table));
    expect(new Set(TenantBespokePolicies.tables()).size).toBe(specs.length);
  });
});
