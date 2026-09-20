import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPlanSummary } from '@/app/sites/import/import-plan-summary.client';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';

/**
 * "You get" must count only rows that actually land. A non-SKIP table's `rows` count (from the
 * archive manifest) still includes the platform-key / uninstalled-plugin-settings rows the
 * executor's rowFilter drops at import time (`_system_meta`, `_system_plugin_settings`) — those
 * are reported separately, so counting them again here double-counts the same rows in both totals.
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
  isJournal: false,
  ...overrides,
});

const emptyUsers = { total: 0, existing: 0, toCreate: 0 };
const noFiles = { count: 0, colliding: 0 };

/** Renders the summary the way the view does: one record list, split into arriving and not. */
const renderSummary = (tables: IImportPlanTable[], plan: Record<string, any>) => {
  const records = ImportPlanRecord.from(tables, plan.metaRowsExcluded ?? 0, plan.pluginSettingsRowsExcluded ?? 0);
  const arriving = records.filter((record) => !record.isEmpty && record.outcome !== ImportPlanOutcome.NONE);
  return render(<ImportPlanSummary plan={plan} records={records} arriving={arriving} />);
};

describe('ImportPlanSummary -> You get', () => {
  it('subtracts the excluded _system_meta and _system_plugin_settings rows from the arriving total', () => {
    renderSummary(
      [
        table({ name: '_system_meta', rows: 12 }),
        table({ name: '_system_plugin_settings', rows: 8 }),
        table({ name: 'fcp_alpha_widgets', rows: 5 }),
      ],
      { metaRowsExcluded: 10, pluginSettingsRowsExcluded: 3, users: emptyUsers, files: noFiles },
    );

    // Raw sum would be 12 + 8 + 5 = 25; only 2 meta rows and 5 plugin-settings rows actually land,
    // so the true arriving total is 25 - 10 - 3 = 12.
    expect(screen.getByText(/12 records in total/)).not.toBeNull();
  });

  it('counts every row when nothing is excluded', () => {
    renderSummary(
      [table({ name: 'fcp_alpha_widgets', rows: 5 })],
      { metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: noFiles },
    );

    expect(screen.getByText(/5 records in total/)).not.toBeNull();
    // The one arriving table has a human label, so it headlines the tiles too.
    expect(screen.getByText(/Widgets/)).not.toBeNull();
  });

  it('folds an unlabelled table into the platform-records tile and nets its excluded rows out of it', () => {
    // `_system_meta` carries NO collection label (it is a framework table), so it falls into the
    // platform-records tile rather than headlining the named ones — and that tile's own total must
    // net out the 10 excluded rows the same way the grand total does, or the two figures on this
    // screen would not add up (the defect this test guards against).
    renderSummary(
      [table({ name: '_system_meta', rows: 12, label: null, pluginSlug: null })],
      { metaRowsExcluded: 10, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: noFiles },
    );

    expect(screen.getByText(/\+2/)).not.toBeNull();
    expect(screen.getByText(/2 records in total/)).not.toBeNull();
  });

  it('shows people in the tiles when the archive carries any', () => {
    renderSummary(
      [table({ name: 'fcp_alpha_widgets', rows: 3 })],
      { metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: { total: 40, existing: 5, toCreate: 35 }, files: noFiles },
    );

    // "People" alone also matches the unrelated "Nothing here is replaced" card below, so assert the
    // tile's own count-and-label pairing instead of the bare word.
    expect(screen.getByText((_, node) => node?.className === 'fc-import-plan__tile' && /40\s*People/.test(node.textContent ?? ''))).not.toBeNull();
    expect(screen.getByText(/35 new account\(s\) will be created/)).not.toBeNull();
  });

  it('tells the operator what to do about records with nowhere to go, without naming a table', () => {
    renderSummary(
      [table({ name: 'fcp_gamma_orders', rows: 9, mode: 'skip', basis: 'noTable', label: null, pluginSlug: 'gamma' })],
      { metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: noFiles },
    );

    // The consequence, in the shop's words — and never the mechanics that used to lead the screen.
    expect(screen.getByText(/9 record\(s\) have nowhere to go until the add-on that owns them is installed here/)).not.toBeNull();
    expect(screen.queryByText(/Expand a table below/)).toBeNull();
    expect(screen.queryByText(/LOWEST ID/)).toBeNull();
  });

  it('does not invent a settings warning when the plan measured the secrets as readable', () => {
    renderSummary(
      [table({ name: 'fcp_alpha_widgets', rows: 1 })],
      { metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: noFiles, secretsArrive: true },
    );

    expect(screen.getByText(/Your settings come with it/)).not.toBeNull();
    expect(screen.queryByText(/need a password/)).toBeNull();
  });
});
