import { AdminAppearanceConstants } from './admin-appearance-constants';
import type { AdminAppearanceResolutionInput } from './admin-appearance-resolution-input.interfaces';

/**
 * Pure resolver that picks the active admin appearance id. Precedence: tenant override → deployment
 * default → built-in default. A candidate that is not registered is skipped. The built-in default
 * is always returned as the final fallback even if absent from `registeredIds`.
 */
export class AdminAppearanceResolver {
  static resolveAppearanceId(input: AdminAppearanceResolutionInput): string {
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
