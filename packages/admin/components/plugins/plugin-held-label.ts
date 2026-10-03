import { PluginHeldReason } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What a held plugin's badge says, from the reason it is held (a raw string in API JSON). */
export class PluginHeldLabel {
  static of(reason: unknown): string {
    const resolved = PluginHeldReason.resolve(reason);
    if (resolved === PluginHeldReason.AWAITING_APPROVAL) return AdminI18n.t('plugins.list.awaitingApproval');
    if (resolved === PluginHeldReason.CAPABILITY_DRIFT) return AdminI18n.t('plugins.list.needsReApproval');
    return AdminI18n.t('plugins.list.held');
  }
}
