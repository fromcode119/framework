import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import type { IImportPlanPluginGroup } from '@/app/sites/import/interfaces/import-plan-plugin-group.interface';

/**
 * Buckets tables by `pluginSlug`, `platform` for a framework table or an unmatched one.
 *
 * Shared by the "Empty" group and the "platform records" fold under Arrives — both need the exact
 * same rule (own plugin's tables together, framework tables in one named bucket, alphabetical
 * otherwise, `platform` last) and neither may hardcode a plugin's name to get it: the bucket key is
 * whatever the plan already put in `pluginSlug`.
 */
export class ImportPlanGrouping {
  static byPlugin(tables: IImportPlanTable[]): IImportPlanPluginGroup[] {
    const order: string[] = [];
    const groups = new Map<string, IImportPlanTable[]>();
    for (const table of tables) {
      const key = table.pluginSlug ?? 'platform';
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(table);
    }
    order.sort((a, b) => {
      if (a === 'platform') return b === 'platform' ? 0 : 1;
      if (b === 'platform') return -1;
      return a.localeCompare(b);
    });
    return order.map((key) => ({ key, tables: groups.get(key)! }));
  }
}
