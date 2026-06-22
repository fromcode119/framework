import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminComponentKeys } from './admin-component-keys';
import { AdminComponentRegistry } from './admin-component-registry';

/**
 * Registers the framework's built-in admin primitives as the default component set. Called once at
 * admin boot. Appearances override individual primitives via registry.registerForAppearance; these
 * defaults are the fallback every appearance inherits.
 */
export class DefaultAdminComponentsBootstrap {
  static register(registry: AdminComponentRegistry): void {
    registry.registerDefault(AdminComponentKeys.BUTTON, Button);
    registry.registerDefault(AdminComponentKeys.INPUT, Input);
  }
}
