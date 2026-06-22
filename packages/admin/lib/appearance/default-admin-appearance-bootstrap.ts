import { AdminAppearanceConstants } from './admin-appearance-constants';
import { AdminAppearanceRegistry } from './admin-appearance-registry';

/**
 * Registers the framework's built-in default admin appearance. Called once at admin boot. The default
 * appearance IS the existing packages/admin presentation — it is never relocated to admin-appearances/.
 */
export class DefaultAdminAppearanceBootstrap {
  static register(registry: AdminAppearanceRegistry): void {
    registry.register({
      id: AdminAppearanceConstants.DEFAULT_APPEARANCE_ID,
      label: 'Atlantis (default)',
      description: 'The built-in Fromcode admin appearance.',
    });
  }
}
