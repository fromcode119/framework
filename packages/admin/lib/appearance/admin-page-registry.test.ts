import { describe, expect, it } from 'vitest';
import { AdminPageRegistry } from './admin-page-registry';

const DefaultDashboard = () => null;
const SimpleDashboard = () => null;

describe('AdminPageRegistry', () => {
  it('returns undefined when no override or default is registered', () => {
    const registry = new AdminPageRegistry();
    expect(registry.resolve('default', 'dashboard')).toBeUndefined();
  });

  it('resolves a registered default when the appearance has no override', () => {
    const registry = new AdminPageRegistry();
    registry.registerDefault('dashboard', DefaultDashboard);
    expect(registry.resolve('default', 'dashboard')).toBe(DefaultDashboard);
  });

  it('prefers an appearance override over the default for that appearance only', () => {
    const registry = new AdminPageRegistry();
    registry.registerDefault('dashboard', DefaultDashboard);
    registry.registerForAppearance('simple', 'dashboard', SimpleDashboard);
    expect(registry.resolve('simple', 'dashboard')).toBe(SimpleDashboard);
    expect(registry.resolve('default', 'dashboard')).toBe(DefaultDashboard);
  });

  it('exposes a shared singleton instance', () => {
    expect(AdminPageRegistry.shared).toBeInstanceOf(AdminPageRegistry);
  });
});
