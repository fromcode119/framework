import { describe, expect, it } from 'vitest';
import { AdminAppearanceResolver } from './admin-appearance-resolver';

describe('AdminAppearanceResolver.resolveAppearanceId', () => {
  const registeredIds = ['default', 'simple', 'studio'];

  it('prefers a registered tenant override over everything', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: 'studio',
      deploymentAppearanceId: 'simple',
      registeredIds,
    });
    expect(id).toBe('studio');
  });

  it('falls back to the deployment default when no tenant override', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: null,
      deploymentAppearanceId: 'simple',
      registeredIds,
    });
    expect(id).toBe('simple');
  });

  it('falls back to the built-in default when nothing is set', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({ registeredIds });
    expect(id).toBe('default');
  });

  it('skips an unregistered tenant id and uses the next valid candidate', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: 'ghost',
      deploymentAppearanceId: 'simple',
      registeredIds,
    });
    expect(id).toBe('simple');
  });

  it('returns the built-in default even when no candidate is registered', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: 'ghost',
      deploymentAppearanceId: 'phantom',
      registeredIds: [],
    });
    expect(id).toBe('default');
  });

  it('treats blank/whitespace candidates as unset', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: '   ',
      deploymentAppearanceId: 'simple',
      registeredIds,
    });
    expect(id).toBe('simple');
  });
});
