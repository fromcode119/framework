import { AdminAppearanceConstants } from '@/lib/appearance/constants/admin-appearance.constants';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Registers the framework's built-in default admin appearance. Called once at admin boot. The default
 * appearance IS the existing packages/admin presentation — it is never relocated to admin-appearances/.
 */
export class DefaultAdminAppearanceBootstrap {
  static register(registry: AdminAppearanceRegistry): void {
    registry.register({
      id: AdminAppearanceConstants.DEFAULT_APPEARANCE_ID,
      label: AdminI18n.t('lib.atlantisDefault'),
      description: AdminI18n.t('lib.theBuiltInFromcodeAdmin'),
    });
  }
}
