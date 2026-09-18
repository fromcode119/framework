import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';
import type { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportPlanner } from '@core/tenant/provisioning/tenant-import-planner';
import type { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

function fakeRegistry(): TenantRegistryService {
  return { assertAvailable: vi.fn(async () => undefined) } as unknown as TenantRegistryService;
}

function fakeDb(): IDatabaseManager {
  return {
    findOne: vi.fn(async () => null),
  } as unknown as IDatabaseManager;
}

function fakeReader(manifest: TenantArchiveManifest): TenantArchiveReader {
  return {
    manifest,
    rows: async function* rows() { /* none */ },
    users: async function* users() { /* none */ },
    fileNames: () => [],
    filePath: () => null,
    close: () => undefined,
  } as unknown as TenantArchiveReader;
}

function manifestWith(tables: Array<{ name: string; rows: number; columns: string[]; hasSerialId: boolean }>, warnings: string[]): TenantArchiveManifest {
  return new TenantArchiveManifest(
    1, '2026-01-01T00:00:00.000Z', '0.0.0', 'tenant',
    { id: 'alpha-co', slug: 'alpha-co', primaryHost: 'alpha-co.test', hostAliases: [], state: 'active', kind: 'site', appearance: '' },
    [], null,
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
});
