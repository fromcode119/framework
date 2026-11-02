import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageReportService } from '@core/usage-report/usage-report-service';
import { UsageReportDefaults } from '@core/usage-report/usage-report-defaults';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemUpdateService } from '@core/management/system-update-service';
import { TenantMode } from '@core/tenant/tenant-mode';
import { SystemConstants } from '@core/constants/system.constants';

/** `_system_meta` in memory, behind the platform-admin marker the store uses. */
class MetaTable {
  readonly dialect = 'postgres';
  readonly rows = new Map<string, any>();
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
  async findOne(_table: string, where: { key: string }) { return this.rows.get(where.key) ?? null; }
  async update(_table: string, where: { key: string }, patch: any) { Object.assign(this.rows.get(where.key), patch); }
  async insert(_table: string, row: any) { this.rows.set(row.key, { ...row }); }
}

describe('UsageReportService', () => {
  let db: MetaTable;
  let enabled: boolean;
  let address: string;
  const plugins = [
    { manifest: { slug: 'shop', version: '1.2.0' } },
    { manifest: { slug: 'cms', version: '0.1.88' } },
    { manifest: { slug: 'core-ui', version: '0.2.0', bundled: true } },
  ];
  const service = () => new UsageReportService({ db, getPlugins: () => plugins });

  beforeEach(() => {
    db = new MetaTable();
    enabled = false;
    address = '';
    vi.spyOn(PlatformSettingsService, 'readFlag').mockImplementation(async () => enabled);
    vi.spyOn(PlatformSettingsService, 'resolve').mockImplementation(async (_env: any, _key: string, fallback: string) => address || fallback);
    vi.spyOn(SystemUpdateService, 'installedVersion').mockReturnValue('0.2.477');
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204 })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('sends nothing on the scheduled run while the switch is off — the default', async () => {
    expect(await service().run()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(db.rows.size).toBe(0);
  });

  it('builds a report that names no site, person or key', async () => {
    const report = await service().build();
    expect(Object.keys(report).sort()).toEqual(['database', 'frameworkVersion', 'installId', 'nodeVersion', 'platform', 'plugins', 'sites']);
    expect(report).toMatchObject({ frameworkVersion: '0.2.477', database: 'postgres', sites: 1 });
    expect(report.plugins).toEqual([{ slug: 'cms', version: '0.1.88' }, { slug: 'shop', version: '1.2.0' }]);
    expect(report.installId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps one installation id across reports', async () => {
    const first = await service().build();
    const second = await service().build();
    expect(second.installId).toBe(first.installId);
  });

  it('posts to the declared default marketplace when the address is blank, and records the outcome', async () => {
    enabled = true;
    const status = await service().run(new Date('2026-11-02T08:00:00Z'));
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe(`${UsageReportDefaults.ADDRESS}/api/plugins/marketplace/webhooks/usage`);
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body)).toHaveProperty('installId');
    expect(status).toMatchObject({ ok: true, at: '2026-11-02T08:00:00.000Z' });
    expect(await service().status()).toEqual(status);
  });

  it('posts to the address the operator set', async () => {
    address = 'https://market.example';
    await service().send();
    expect((fetch as any).mock.calls[0][0]).toBe('https://market.example/api/plugins/marketplace/webhooks/usage');
  });

  it('records a refusal and an unreachable address as failures, with the reason', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await service().send()).toMatchObject({ ok: false, message: 'The address answered 404.' });
    (fetch as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect((await service().send()).message).toContain('ECONNREFUSED');
    expect(JSON.parse(db.rows.get(SystemConstants.META_KEY.USAGE_REPORT_STATUS).value).ok).toBe(false);
  });

  it('sends nothing to an address that is not http(s)', async () => {
    address = 'ftp://market.example';
    expect(await service().send()).toMatchObject({ ok: false, target: '' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
