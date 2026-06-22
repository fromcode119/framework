import { describe, expect, it } from 'vitest';
import { AdminAppearanceRegistry } from './admin-appearance-registry';

describe('AdminAppearanceRegistry', () => {
  it('registers and retrieves a appearance by id', () => {
    const registry = new AdminAppearanceRegistry();
    registry.register({ id: 'simple', label: 'Simple' });
    expect(registry.has('simple')).toBe(true);
    expect(registry.get('simple')).toEqual({ id: 'simple', label: 'Simple' });
  });

  it('reports unknown ids as absent and returns undefined', () => {
    const registry = new AdminAppearanceRegistry();
    expect(registry.has('nope')).toBe(false);
    expect(registry.get('nope')).toBeUndefined();
  });

  it('lists manifests and ids', () => {
    const registry = new AdminAppearanceRegistry();
    registry.register({ id: 'a', label: 'A' });
    registry.register({ id: 'b', label: 'B' });
    expect(registry.ids().sort()).toEqual(['a', 'b']);
    expect(registry.list().map((d) => d.id).sort()).toEqual(['a', 'b']);
  });

  it('overwrites a appearance when the same id registers again', () => {
    const registry = new AdminAppearanceRegistry();
    registry.register({ id: 'a', label: 'First' });
    registry.register({ id: 'a', label: 'Second' });
    expect(registry.ids()).toEqual(['a']);
    expect(registry.get('a')?.label).toBe('Second');
  });

  it('exposes a shared singleton instance', () => {
    expect(AdminAppearanceRegistry.shared).toBeInstanceOf(AdminAppearanceRegistry);
  });
});
