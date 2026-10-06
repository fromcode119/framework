import { describe, expect, it } from 'vitest';
import { TenantSummary } from '@api/services/tenants/tenant-summary';

/**
 * Creating a site answers with what became of its theme's initial content. A later read of the same
 * site has no such thing to say, so the fields are absent there rather than a stale `false`.
 */
describe('create answer carries the theme seed outcome', () => {
  const tenant = { id: 't1', slug: 'shop', primaryHost: 'shop.test', hostAliases: [], hostRoles: {}, state: 'active', isActive: true,
    kind: { value: 'site' }, visibility: { value: 'private' }, environment: { value: 'production' }, isIndexable: false, appearance: '' } as any;

  it('includes themeSeeded, its reason and the warnings', () => {
    const json = new TenantSummary(tenant, 0, [], 'shop-theme', null, 0)
      .withCreation({ themeSeeded: false, themeSeedReason: 'seed failed: boom', warnings: ['Theme "shop-theme" seed failed: boom'] })
      .toJSON();
    expect(json.themeSeeded).toBe(false);
    expect(json.themeSeedReason).toBe('seed failed: boom');
    expect(json.warnings).toEqual(['Theme "shop-theme" seed failed: boom']);
  });

  it('leaves them out of an ordinary read', () => {
    const json = new TenantSummary(tenant, 0, [], null, null, 0).toJSON();
    expect(json).not.toHaveProperty('themeSeeded');
  });
});
