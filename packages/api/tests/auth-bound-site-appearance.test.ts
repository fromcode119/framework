import { describe, expect, it, vi } from 'vitest';
import { AppearanceManager, PlatformSettingsService, SystemConstants, TenantMode } from '@fromcode119/core';
import { AuthControllerTenantSelection } from '@api/controllers/auth/auth-controller-tenant-selection';

/**
 * Every member of a site wears the site's console, not only its administrators.
 *
 * The admin read a site's `admin_appearance` from `/system/admin/settings`, which needs
 * `system:manage`. A member holding one plugin's screens was refused that read and got the default
 * console. `/auth/tenants/available` now carries the bound scope's appearance.
 */
class MetaStub {
  boundTo: string | null = null;
  constructor(private readonly rowsBySite: Record<string, Record<string, string>>) {}

  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    this.boundTo = tenantId;
    try { return await fn(); } finally { this.boundTo = null; }
  }

  async findOne(_table: string, where: { key: string }): Promise<{ key: string; value: string } | null> {
    const rows = this.boundTo ? this.rowsBySite[this.boundTo] ?? {} : this.rowsBySite.platform ?? {};
    return where.key in rows ? { key: where.key, value: rows[where.key] } : null;
  }
}

class AppearanceProbe extends AuthControllerTenantSelection {
  read(tenant: { id: string; kind: string; appearance: string }) { return this.boundAppearance(tenant); }
  shadows(tenant: { id: string; kind: string }) { return this.boundShadows(tenant); }
  brand(appearance: string) { return this.boundBrand(appearance); }
}

const installed = (items: Array<Record<string, unknown>>) =>
  vi.spyOn(AppearanceManager.prototype, 'list').mockReturnValue(items as any);

const KEY = SystemConstants.META_KEY.ADMIN_APPEARANCE;
const SHADOWS = SystemConstants.META_KEY.ADMIN_SHADOWS;
const db = new MetaStub({ platform: { [KEY]: 'platform-brand', [SHADOWS]: 'false' }, rb: { [KEY]: 'replybird', [SHADOWS]: 'false' }, bare: {} });
const probe = new AppearanceProbe({ db, hooks: { call: vi.fn() } } as any, {} as any);

describe('the appearance of the bound scope', () => {
  it("is a site's own admin_appearance setting, read on that site's scope", async () => {
    expect(await probe.read({ id: 'rb', kind: 'site', appearance: '' })).toBe('replybird');
  });

  it("is blank for a site with no setting — never the platform's choice", async () => {
    expect(await probe.read({ id: 'bare', kind: 'site', appearance: '' })).toBe('');
  });

  it("is a workspace's kind lock, with no setting read", async () => {
    expect(await probe.read({ id: 'ws', kind: 'workspace', appearance: 'locked' })).toBe('locked');
  });

  it("carries the site's own admin_shadows, and '' where it has none", async () => {
    expect(await probe.shadows({ id: 'rb', kind: 'site' })).toBe('false');
    expect(await probe.shadows({ id: 'bare', kind: 'site' })).toBe('');
    expect(await probe.shadows({ id: 'ws', kind: 'workspace' })).toBe('');
  });
});

describe('the login on a console host', () => {
  async function hostInfo(tenant: Record<string, unknown>) {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(PlatformSettingsService, 'readFlag').mockResolvedValue(false);
    const json = vi.fn();
    await probe.hostInfo({ workspaceTenant: tenant } as any, { json } as any);
    return json.mock.calls[0][0].workspace;
  }

  it("wears a site's own appearance on its console path, not the built-in console", async () => {
    installed([{ slug: 'replybird', name: 'Replybird', icon: 'mark.png', builtIn: false }]);
    expect(await hostInfo({ id: 'rb', slug: 'rb', kind: { value: 'site' }, appearance: '' })).toEqual({
      id: 'rb', slug: 'rb', appearance: 'replybird',
      brand: { name: 'Replybird', icon: '/appearances/replybird/ui/mark.png' },
    });
  });

  it("wears a workspace's kind lock", async () => {
    expect((await hostInfo({ id: 'ws', slug: 'ws', kind: { value: 'workspace' }, appearance: 'locked' })).appearance).toBe('locked');
  });
});

/**
 * The console's page head is written on the server, before any appearance code runs. It named the
 * platform until the appearance loaded and swapped it, and never swapped the icons at all. The host
 * route now names the worn appearance's own `name` and declared `icon`.
 */
describe('the brand of the bound appearance', () => {
  it("is the installed appearance's name and its icon's admin path", () => {
    installed([{ slug: 'replybird', name: 'Replybird', icon: 'mark.png', builtIn: false }]);
    expect(probe.brand('replybird')).toEqual({ name: 'Replybird', icon: '/appearances/replybird/ui/mark.png' });
  });

  it('names the appearance with no icon when it declares none', () => {
    installed([{ slug: 'plain', name: 'Plain', builtIn: false }]);
    expect(probe.brand('plain')).toEqual({ name: 'Plain', icon: '' });
  });

  it.each(['../secret.png', 'sub/mark.png', '.hidden'])('refuses an icon that is not a plain file in ui/ (%s)', (icon) => {
    installed([{ slug: 'x', name: 'X', icon, builtIn: false }]);
    expect(probe.brand('x')).toEqual({ name: 'X', icon: '' });
  });

  it("is null for the built-in console, an appearance that is not installed, and no appearance — the platform's own identity stays", () => {
    installed([{ slug: 'default', name: 'Default', builtIn: true }]);
    expect(probe.brand('default')).toBeNull();
    expect(probe.brand('gone')).toBeNull();
    expect(probe.brand('')).toBeNull();
  });
});
