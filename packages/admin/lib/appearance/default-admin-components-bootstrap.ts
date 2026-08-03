import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { AdminComponentKeys } from '@/lib/appearance/admin-component-keys';
import { AdminComponentRegistry } from '@/lib/appearance/admin-component-registry';

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
