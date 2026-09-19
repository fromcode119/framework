import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPlanTableRow } from '@/app/sites/import/import-plan-table-row.client';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { ImportPlanRowKind } from '@/app/sites/import/enums/import-plan-row-kind.enum';

/**
 * `_system_meta`/`_system_plugin_settings` are the only two tables the executor's own rowFilter ever
 * drops rows from at import time — a defect let a row like this claim "nothing lost" even though the
 * summary above it says rows from that exact table will not come across. These tests pin the row's
 * own loss chip (and its disclosure) to the real `metaRowsExcluded`/`pluginSettingsRowsExcluded`
 * figures, never to invented text.
 */
const table = (overrides: Partial<IImportPlanTable>): IImportPlanTable => ({
  name: 'fcp_alpha_widgets',
  rows: 5,
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

describe('ImportPlanTableRow -> loss chip', () => {
  it('never claims "nothing lost" for a table with excluded rows', () => {
    render(
      <ImportPlanTableRow
        table={table({ name: '_system_meta', rows: 12, label: null, pluginSlug: null, basis: 'naturalKey' })}
        kind={ImportPlanRowKind.KEPT}
        metaRowsExcluded={10}
        pluginSettingsRowsExcluded={0}
      />,
    );

    expect(screen.queryByText(/nothing lost/)).toBeNull();
    expect(screen.getByText(/10 rows not carried over/)).not.toBeNull();
  });

  it('names the excluded rows and their source table in the row\'s own disclosure', () => {
    render(
      <ImportPlanTableRow
        table={table({ name: '_system_plugin_settings', rows: 8, label: null, pluginSlug: null, basis: 'naturalKey' })}
        kind={ImportPlanRowKind.KEPT}
        metaRowsExcluded={0}
        pluginSettingsRowsExcluded={3}
      />,
    );

    expect(screen.getByText(/3 rows not carried over/)).not.toBeNull();
    expect(screen.getByText(/Rows not carried over/)).not.toBeNull();
    expect(screen.getByText(/are for a plugin not installed here/)).not.toBeNull();
  });

  it('still says "nothing lost" for an unrelated table with no excluded rows', () => {
    render(
      <ImportPlanTableRow
        table={table({ name: 'fcp_alpha_widgets', rows: 5 })}
        kind={ImportPlanRowKind.KEPT}
        metaRowsExcluded={10}
        pluginSettingsRowsExcluded={3}
      />,
    );

    expect(screen.getByText(/nothing lost/)).not.toBeNull();
  });
});

describe('ImportPlanTableRow -> why the id was kept (basis)', () => {
  it('states the real reason for basis "empty", never the aboveSequence claim', () => {
    render(
      <ImportPlanTableRow
        table={table({ basis: 'empty', taken: 40 })}
        kind={ImportPlanRowKind.KEPT}
        metaRowsExcluded={0}
        pluginSettingsRowsExcluded={0}
      />,
    );

    expect(screen.getByText(/this table has no rows with a numeric id to compare/)).not.toBeNull();
    expect(screen.queryByText(/every id in the archive is already above/)).toBeNull();
  });

  it('states the aboveSequence reason for basis "aboveSequence"', () => {
    render(
      <ImportPlanTableRow
        table={table({ basis: 'aboveSequence', taken: 40 })}
        kind={ImportPlanRowKind.KEPT}
        metaRowsExcluded={0}
        pluginSettingsRowsExcluded={0}
      />,
    );

    expect(screen.getByText(/every id in the archive is already above what this platform has handed out/)).not.toBeNull();
  });
});
