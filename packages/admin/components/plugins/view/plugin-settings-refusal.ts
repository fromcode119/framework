import { EntityFieldErrorCode } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IEntityFieldValidationError } from '@fromcode119/core/client';

/** Settings the server refused, as the words under each field — in the console's language when the refusal has a code. */
export class PluginSettingsRefusal {
  private static readonly WORDS: Record<string, string> = {
    [EntityFieldErrorCode.REQUIRED.value]: 'plugins.list.refusal.required',
    [EntityFieldErrorCode.NOT_A_NUMBER.value]: 'plugins.list.refusal.notANumber',
    [EntityFieldErrorCode.BELOW_MIN.value]: 'plugins.list.refusal.belowMin',
    [EntityFieldErrorCode.ABOVE_MAX.value]: 'plugins.list.refusal.aboveMax',
    [EntityFieldErrorCode.NOT_AN_EMAIL.value]: 'plugins.list.refusal.notAnEmail',
    [EntityFieldErrorCode.NOT_A_URL.value]: 'plugins.list.refusal.notAUrl',
    [EntityFieldErrorCode.NOT_AN_OPTION.value]: 'plugins.list.refusal.notAnOption',
  };

  static perField(data: { errors?: Record<string, string | string[]>; refusals?: IEntityFieldValidationError[] }): Record<string, string | string[]> {
    const said: Record<string, string | string[]> = { ...(data.errors || {}) };
    for (const refusal of data.refusals || []) {
      const key = refusal.code ? PluginSettingsRefusal.WORDS[refusal.code] : undefined;
      if (key) said[refusal.field] = AdminI18n.t(key, refusal.vars || {});
    }
    return said;
  }
}
