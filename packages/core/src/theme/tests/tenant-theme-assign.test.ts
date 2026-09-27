import { describe, expect, it, vi } from 'vitest';
import { TenantThemeStateService } from '@core/theme/tenant-theme-state-service';

/** Adding a theme to a site makes it one of the site's themes — and never resets one it already has. */
describe('TenantThemeStateService.assign', () => {
  const dbWith = (rows: Array<Record<string, unknown>>) => ({
    find: vi.fn(async () => rows),
    insert: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  });

  it('adds the theme to the site inactive, with the theme defaults', async () => {
    const db = dbWith([]);
    await new TenantThemeStateService(db).assign('site-a', 'aurora');
    expect(db.insert).toHaveBeenCalledWith(expect.any(String), { tenant_id: 'site-a', theme_slug: 'aurora', state: 'inactive', config: null });
  });

  it('leaves a theme the site already has exactly as it is — its state and its settings', async () => {
    const db = dbWith([{ tenant_id: 'site-a', theme_slug: 'aurora', state: 'active', config: '{"brand":"red"}' }]);
    await new TenantThemeStateService(db).assign('site-a', 'aurora');
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
