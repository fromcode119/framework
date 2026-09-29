import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IArchiveResult } from '@/components/collection/list/interfaces/archive-result.interface';

/**
 * Archive and Restore from the list screen, and what the operator is told afterwards.
 *
 * The notice names every collection the archive reached through its keys ("Also archived: Invoices 1,
 * Transactions 1"), and every one it could not — an order vanishing from the list must never quietly
 * take, or fail to take, its paperwork with it.
 */
export class ArchiveOperations {
  static async run(resolvedSlug: string, ids: string[], archiving: boolean): Promise<IArchiveResult> {
    const endpoint = archiving
      ? AdminConstants.ENDPOINTS.COLLECTIONS.ARCHIVE(resolvedSlug)
      : AdminConstants.ENDPOINTS.COLLECTIONS.RESTORE(resolvedSlug);
    return AdminApi.post(endpoint, { ids });
  }

  static summary(result: IArchiveResult, archiving: boolean): { title: string; message: string } {
    const title = AdminI18n.t(archiving ? 'collection.list.archived' : 'collection.list.restored', { count: result.count });
    const reached = result.cascaded.filter((outcome) => !outcome.skipped && outcome.count > 0);
    const skipped = result.cascaded.filter((outcome) => outcome.skipped);
    const lines: string[] = [];
    if (reached.length) {
      lines.push(AdminI18n.t(archiving ? 'collection.list.archiveAlso' : 'collection.list.restoreAlso', {
        list: reached.map((outcome) => `${outcome.label} ${outcome.count}`).join(', '),
      }));
    }
    if (skipped.length) {
      lines.push(AdminI18n.t('collection.list.archiveSkipped', { list: skipped.map((outcome) => outcome.label).join(', ') }));
    }
    if (!lines.length && result.cascaded.length) lines.push(AdminI18n.t('collection.list.archiveNothing'));
    return { title, message: lines.join(' ') };
  }
}
