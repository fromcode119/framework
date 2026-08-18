import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { NamingStrategy } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * Audits plugin `context.db` writes — one row per CALL, naming the target table (and, when the
 * where already carries it, the record id): `fcp_ecommerce_products/8`. The method travels in the
 * row's metadata. Payload values never reach the audit trail (PII).
 *
 * The whole path is fire-and-forget: the exclusion check and the audit insert run behind the
 * write's back, and every failure is swallowed — an audit outage must never break or slow a write.
 *
 * Operators exclude high-volume tables (analytics events/sessions) through the
 * `audit_db_write_excluded_tables` system setting (admin Settings → Security — a declared,
 * seeded setting, per NO MAGIC). The set is cached per manager and re-read after {@link REFRESH_MS},
 * so a change applies within a minute without a restart. When the setting cannot be read, nothing
 * is excluded — the trail fails towards completeness, never towards silence.
 */
export class DatabaseWriteAudit {
  private static readonly REFRESH_MS = 60_000;
  private static readonly exclusionsByManager = new WeakMap<object, { promise: Promise<Set<string>>; fetchedAt: number }>();

  /** Fire-and-forget: never throws, never blocks the write it describes. */
  static logWrite(
    manager: IPluginManagerInterface,
    pluginSlug: string,
    method: string,
    tablePrefix: string,
    tableArg: unknown,
    whereArg?: unknown,
  ): void {
    const table = DatabaseWriteAudit.resolvePhysicalTable(tableArg, tablePrefix);
    const recordId = DatabaseWriteAudit.extractRecordId(whereArg);
    const resource = table ? (recordId ? `${table}/${recordId}` : table) : method;

    void DatabaseWriteAudit.getExcludedTables(manager)
      .then((excluded) => {
        if (table && excluded.has(table)) return undefined;
        return manager.audit.logAction(pluginSlug, 'Database Write', resource, 'allowed', { method });
      })
      .catch(() => undefined);
  }

  /** `@slug/table`, `fcp_slug_table` and bare `table` all audit under the one physical name. */
  private static resolvePhysicalTable(tableArg: unknown, tablePrefix: string): string {
    const raw = String(tableArg ?? '').trim().toLowerCase();
    if (!raw) return '';
    const parsed = PhysicalTableNameUtils.parse(raw);
    if (parsed?.physicalName) return parsed.physicalName;
    if (PhysicalTableNameUtils.hasPlatformPrefix(raw) || raw.startsWith('_system_')) return raw;
    const bare = NamingStrategy.toSnakeIdentifier(raw);
    return bare ? `${tablePrefix}${bare}` : raw;
  }

  /** Only a scalar id already present in the where — never anything from a payload. */
  private static extractRecordId(whereArg: unknown): string {
    if (!whereArg || typeof whereArg !== 'object' || Array.isArray(whereArg)) return '';
    const id = (whereArg as Record<string, unknown>).id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  }

  private static getExcludedTables(manager: IPluginManagerInterface): Promise<Set<string>> {
    const now = Date.now();
    const cached = DatabaseWriteAudit.exclusionsByManager.get(manager);
    if (cached && now - cached.fetchedAt < DatabaseWriteAudit.REFRESH_MS) return cached.promise;
    const promise = DatabaseWriteAudit.fetchExcludedTables(manager);
    DatabaseWriteAudit.exclusionsByManager.set(manager, { promise, fetchedAt: now });
    return promise;
  }

  private static async fetchExcludedTables(manager: IPluginManagerInterface): Promise<Set<string>> {
    try {
      const row = await manager.db.findOne(SystemConstants.TABLE.META, {
        key: SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES,
      });
      return new Set(
        String(row?.value ?? '')
          .split(/[,;\s]+/)
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  }
}
