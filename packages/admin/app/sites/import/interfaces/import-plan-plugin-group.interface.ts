import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';

/** One bucket of `ImportPlanGrouping.byPlugin` — the tables owned by a single plugin, or the `platform` bucket. */
export interface IImportPlanPluginGroup {
  key: string;
  tables: IImportPlanTable[];
}
