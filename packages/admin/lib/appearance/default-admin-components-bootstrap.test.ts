import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminComponentKeys } from './admin-component-keys';
import { AdminComponentRegistry } from './admin-component-registry';
import { DefaultAdminComponentsBootstrap } from './default-admin-components-bootstrap';

describe('DefaultAdminComponentsBootstrap', () => {
  it('registers today\'s primitives as the default component set', () => {
    const registry = new AdminComponentRegistry();
    DefaultAdminComponentsBootstrap.register(registry);
    expect(registry.resolve('default', AdminComponentKeys.BUTTON)).toBe(Button);
    expect(registry.resolve('default', AdminComponentKeys.INPUT)).toBe(Input);
  });

  it('makes defaults resolvable for any appearance that does not override them', () => {
    const registry = new AdminComponentRegistry();
    DefaultAdminComponentsBootstrap.register(registry);
    expect(registry.resolve('simple', AdminComponentKeys.BUTTON)).toBe(Button);
  });
});
