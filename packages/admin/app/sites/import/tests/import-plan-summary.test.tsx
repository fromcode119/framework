import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPlanSummary } from '@/app/sites/import/import-plan-summary.client';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';

/**
 * "Arrives" must count only rows that actually land. A non-SKIP table's `rows` count (from the
 * archive manifest) still includes the platform-key / uninstalled-plugin-settings rows the
 * executor's rowFilter drops at import time (`_system_meta`, `_system_plugin_settings`) — those
 * are reported separately under "Left behind" via `metaRowsExcluded`/`pluginSettingsRowsExcluded`,
 * so counting them again in "Arrives" double-counts the same rows in both totals.
 */
const table = (overrides: Partial<IImportPlanTable>): IImportPlanTable => ({
  name: 'fcp_alpha_widgets',
  rows: 0,
  mode: 'preserve',
  basis: 'naturalKey',
  minId: null,
  taken: null,
  opaqueJsonColumns: [],
  repointedReferences: [],
  droppedColumns: [],
  pluginSlug: 'alpha',
  label: 'Widgets',
  ...overrides,
});

describe('ImportPlanSummary -> Arrives', () => {
  it('subtracts the excluded _system_meta and _system_plugin_settings rows from the arriving total', () => {
    const arriving: IImportPlanTable[] = [
      table({ name: '_system_meta', rows: 12 }),
      table({ name: '_system_plugin_settings', rows: 8 }),
      table({ name: 'fcp_alpha_widgets', rows: 5 }),
    ];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 10, pluginSettingsRowsExcluded: 3, files: { count: 0, colliding: 0 } }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    // Raw sum would be 12 + 8 + 5 = 25; only 2 meta rows and 5 plugin-settings rows actually land,
    // so the true arriving total is 25 - 10 - 3 = 12.
    expect(screen.getByText(/12 row\(s\) across 3 table\(s\)\./)).not.toBeNull();
  });

  it('counts every row when nothing is excluded', () => {
    const arriving: IImportPlanTable[] = [table({ name: 'fcp_alpha_widgets', rows: 5 })];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, files: { count: 0, colliding: 0 } }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    expect(screen.getByText(/5 row\(s\) across 1 table\(s\)\./)).not.toBeNull();
  });
});
