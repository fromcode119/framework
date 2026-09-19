import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

/**
 * Tables whose rows record what HAPPENED, rather than things an operator manages.
 *
 * Declared, never inferred. A collection that sets both `admin.disableCreate` and
 * `admin.disableEdit` is saying an operator can neither add nor change these rows — which is exactly
 * what an event log, a consent record or a visitor session is. That declaration already existed;
 * reusing it beat inventing a second flag every plugin would have to keep in agreement with the
 * first. The framework's own journals come from the policy that already classifies them.
 *
 * What reads this: a summary naming the biggest kinds would otherwise be all telemetry — 5,810 site
 * events ahead of 198 orders — and bury the handful a reader recognises.
 */
export class TenantJournalTables {
  static from(collections: Array<{ collection: ICollection }>): Set<string> {
    const out = new Set<string>(TenantBespokePolicies.journalTables());
    for (const { collection } of collections) {
      // `system: true` marks the framework's OWN collections — settings, users, the media registry.
      // "Global Settings" is one, and with telemetry filtered out it led the list ahead of a shop's
      // orders: the platform's plumbing presented as though it were the shop's.
      const declared = collection.system === true
        || (collection.admin?.disableCreate === true && collection.admin?.disableEdit === true);
      if (!declared) continue;
      const table = String(collection.tableName || collection.slug || '').trim();
      if (table) out.add(table);
    }
    return out;
  }
}
