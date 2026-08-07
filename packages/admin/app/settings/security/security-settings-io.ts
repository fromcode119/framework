import { CoercionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SecuritySettingsKeys } from '@/app/settings/security/security-settings-keys';

/**
 * Reads and writes the Security screen's settings, over ONE key list.
 *
 * Load and save used to name their keys separately, which is how a control can end up rendering a
 * value the Save never sends -- the shape of the bug that made "Update Security" report success while
 * the setting never moved. Both directions now walk {@link SecuritySettingsKeys}, so a key is either
 * in the form and in the payload, or in neither.
 */
export class SecuritySettingsIo {
  /**
   * The stored configuration and nothing else. `_system_meta` holds text, so values are handed back
   * as the server's own strings; the row components own the boolean conversion. A rejection
   * propagates -- the page renders a visible load error rather than a form full of code-side seeds.
   */
  static async load(): Promise<Record<string, string>> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS);
    const loaded: Record<string, string> = {};
    for (const key of SecuritySettingsKeys.ALL) {
      loaded[key] = CoercionUtils.toString(response?.[key]);
    }
    return loaded;
  }

  /**
   * Send every key verbatim, empty string included: a cleared internal-clients list is the operator
   * saying "nothing is internal", and the API's resolver honours a saved blank instead of falling
   * back to the seed.
   */
  static async save(settings: Record<string, string>): Promise<void> {
    const payload: Record<string, string> = {};
    for (const key of SecuritySettingsKeys.ALL) {
      payload[key] = CoercionUtils.toString(settings[key]);
    }
    await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, payload);
  }
}
