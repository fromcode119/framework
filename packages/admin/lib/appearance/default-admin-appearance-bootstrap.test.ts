import { describe, expect, it } from 'vitest';
import { AdminAppearanceRegistry } from './admin-appearance-registry';
import { DefaultAdminAppearanceBootstrap } from './default-admin-appearance-bootstrap';

describe('DefaultAdminAppearanceBootstrap', () => {
  it('registers the built-in default appearance into the given registry', () => {
    const registry = new AdminAppearanceRegistry();
    DefaultAdminAppearanceBootstrap.register(registry);
    expect(registry.has('default')).toBe(true);
    expect(registry.get('default')?.label).toBe('Atlantis (default)');
  });

  it('is idempotent — re-registering keeps a single default entry', () => {
    const registry = new AdminAppearanceRegistry();
    DefaultAdminAppearanceBootstrap.register(registry);
    DefaultAdminAppearanceBootstrap.register(registry);
    expect(registry.ids()).toEqual(['default']);
  });
});
