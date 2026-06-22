import { describe, expect, it } from 'vitest';
import { AdminAppearanceRegistry } from './admin-appearance-registry';
import { DefaultAdminAppearanceBootstrap } from './default-admin-appearance-bootstrap';
import { ActiveAdminAppearanceService } from './active-admin-appearance-service';

describe('ActiveAdminAppearanceService.select', () => {
  // The service reads AppEnv.ADMIN_APPEARANCE (empty in tests) and the shared registry.
  // Ensure the built-in default is registered for these cases.
  DefaultAdminAppearanceBootstrap.register(AdminAppearanceRegistry.shared);

  it('returns the built-in default when no tenant override is given', () => {
    expect(ActiveAdminAppearanceService.select({ site_name: 'x' })).toBe('default');
  });

  it('ignores an unregistered tenant override and returns the default', () => {
    expect(ActiveAdminAppearanceService.select({ site_name: 'x', admin_appearance: 'ghost' })).toBe('default');
  });

  it('honors a registered tenant override', () => {
    AdminAppearanceRegistry.shared.register({ id: 'simple', label: 'Simple' });
    expect(ActiveAdminAppearanceService.select({ admin_appearance: 'simple' })).toBe('simple');
  });
});
