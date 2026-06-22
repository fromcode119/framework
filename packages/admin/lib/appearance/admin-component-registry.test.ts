import { describe, expect, it } from 'vitest';
import { AdminComponentRegistry } from './admin-component-registry';

// Dummy components — the registry stores component types opaquely.
const DefaultButton = () => null;
const FancyButton = () => null;
const DefaultInput = () => null;

describe('AdminComponentRegistry', () => {
  it('resolves a registered default when the appearance has no override', () => {
    const registry = new AdminComponentRegistry();
    registry.registerDefault('Button', DefaultButton);
    expect(registry.resolve('default', 'Button')).toBe(DefaultButton);
  });

  it('prefers an appearance override over the default for that appearance only', () => {
    const registry = new AdminComponentRegistry();
    registry.registerDefault('Button', DefaultButton);
    registry.registerForAppearance('simple', 'Button', FancyButton);
    expect(registry.resolve('simple', 'Button')).toBe(FancyButton);
    expect(registry.resolve('default', 'Button')).toBe(DefaultButton);
  });

  it('falls back to default for an appearance that overrides a different primitive', () => {
    const registry = new AdminComponentRegistry();
    registry.registerDefault('Button', DefaultButton);
    registry.registerDefault('Input', DefaultInput);
    registry.registerForAppearance('simple', 'Button', FancyButton);
    expect(registry.resolve('simple', 'Input')).toBe(DefaultInput);
  });

  it('returns undefined for an unknown primitive', () => {
    const registry = new AdminComponentRegistry();
    expect(registry.resolve('default', 'Nope')).toBeUndefined();
  });

  it('exposes a shared singleton instance', () => {
    expect(AdminComponentRegistry.shared).toBeInstanceOf(AdminComponentRegistry);
  });
});
