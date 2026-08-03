import { AdminAppearanceConstants } from '@/lib/appearance/constants/admin-appearance.constants';
import type { IAdminAppearanceResolutionInput } from '@/lib/appearance/interfaces/admin-appearance-resolution-input.interface';

/**
 * Pure resolver that picks the active admin appearance id. Precedence: tenant override → deployment
 * default → built-in default. A candidate that is not registered is skipped. The built-in default
 * is always returned as the final fallback even if absent from `registeredIds`.
 */
export class AdminAppearanceResolver {
  static resolveAppearanceId(input: IAdminAppearanceResolutionInput): string {
    const candidates = [input.tenantAppearanceId, input.deploymentAppearanceId];
    for (const candidate of candidates) {
      const id = (candidate ?? '').trim();
      if (id && input.registeredIds.includes(id)) {
        return id;
      }
    }
    return AdminAppearanceConstants.DEFAULT_APPEARANCE_ID;
  }
}
