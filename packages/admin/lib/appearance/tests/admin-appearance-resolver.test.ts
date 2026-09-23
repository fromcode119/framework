import { describe, expect, it } from 'vitest';
import { AdminAppearanceResolver } from '@/lib/appearance/admin-appearance-resolver';

describe('AdminAppearanceResolver.resolveAppearanceId', () => {
  const registeredIds = ['default', 'plain', 'studio'];

  it('prefers a registered tenant override over everything', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: 'studio',
      deploymentAppearanceId: 'plain',
      registeredIds,
    });
    expect(id).toBe('studio');
  });

  it('falls back to the deployment default when no tenant override', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: null,
      deploymentAppearanceId: 'plain',
      registeredIds,
    });
    expect(id).toBe('plain');
  });

  it('falls back to the built-in default when nothing is set', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({ registeredIds });
    expect(id).toBe('default');
  });

  it('skips an unregistered tenant id and uses the next valid candidate', () => {
    const id = AdminAppearanceResolver.resolveAppearanceId({
      tenantAppearanceId: 'ghost',
      deploymentAppearanceId: 'plain',
      registeredIds,
    });
    expect(id).toBe('plain');
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
      deploymentAppearanceId: 'plain',
      registeredIds,
    });
    expect(id).toBe('plain');
  });
});
