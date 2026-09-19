import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPlanSummary } from '@/app/sites/import/import-plan-summary.client';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';

/**
 * "Arrives" must count only rows that actually land. A non-SKIP table's `rows` count (from the
 * archive manifest) still includes the platform-key / uninstalled-plugin-settings rows the
 * executor's rowFilter drops at import time (`_system_meta`, `_system_plugin_settings`) — those
 * are reported separately under "Won't come across" via `metaRowsExcluded`/`pluginSettingsRowsExcluded`,
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

const emptyUsers = { total: 0, existing: 0, toCreate: 0 };

describe('ImportPlanSummary -> Arrives', () => {
  it('subtracts the excluded _system_meta and _system_plugin_settings rows from the arriving total', () => {
    const arriving: IImportPlanTable[] = [
      table({ name: '_system_meta', rows: 12 }),
      table({ name: '_system_plugin_settings', rows: 8 }),
      table({ name: 'fcp_alpha_widgets', rows: 5 }),
    ];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 10, pluginSettingsRowsExcluded: 3, users: emptyUsers, files: { count: 0, colliding: 0 } }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    // Raw sum would be 12 + 8 + 5 = 25; only 2 meta rows and 5 plugin-settings rows actually land,
    // so the true arriving total is 25 - 10 - 3 = 12.
    expect(screen.getByText(/12 in total\./)).not.toBeNull();
  });

  it('counts every row when nothing is excluded', () => {
    const arriving: IImportPlanTable[] = [table({ name: 'fcp_alpha_widgets', rows: 5 })];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 } }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    expect(screen.getByText(/5 in total\./)).not.toBeNull();
    // The one arriving table has a human label, so it headlines the itemized list too.
    expect(screen.getByText(/Widgets/)).not.toBeNull();
  });

  it('folds an unlabelled table into "platform records" and nets its excluded rows out of that fold', () => {
    // `_system_meta` carries NO collection label (it is a framework table), so it falls into the
    // platform-records fold rather than headlining the itemized list — and that fold's own total
    // must net out the 10 excluded rows the same way the grand total does, or the two figures on
    // this screen would not add up (the defect this test guards against).
    const arriving: IImportPlanTable[] = [table({ name: '_system_meta', rows: 12, label: null, pluginSlug: null })];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 10, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 } }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    // The netting is what this guards — 2, not the raw 5 — and the caption must carry no jargon,
    // because a summary renders while its details is collapsed.
    expect(screen.getByText(/2 more the platform keeps for you/)).not.toBeNull();
    expect(screen.queryByText(/\btables?\b|\brecord\(s\)/i)).toBeNull();
    expect(screen.getByText(/2 in total\./)).not.toBeNull();
  });

  it('shows people in the arrival list when the archive carries any', () => {
    const arriving: IImportPlanTable[] = [table({ name: 'fcp_alpha_widgets', rows: 3 })];
    render(
      <ImportPlanSummary
        plan={{
          metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0,
          users: { total: 40, existing: 5, toCreate: 35 }, files: { count: 0, colliding: 0 },
        }}
        arriving={arriving}
        skipped={[]}
        remapped={[]}
      />,
    );

    // "people" alone also matches the unrelated "Already here" paragraph below, so assert the
    // arrival item's own count-and-label pairing instead of the bare word.
    expect(screen.getByText((_, node) => node?.className === 'fc-import-plan__tile' && /40\s*people/.test(node.textContent ?? ''))).not.toBeNull();
    expect(screen.getByText(/35 new account\(s\) will be created/)).not.toBeNull();
  });

  it('tells the operator what to do about records with nowhere to go, without naming a table', () => {
    const skipped: IImportPlanTable[] = [table({ name: 'fcp_gamma_orders', rows: 9, mode: 'skip', basis: 'noTable', label: null })];
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 } }}
        arriving={[]}
        skipped={skipped}
        remapped={[]}
      />,
    );

    // The consequence, in the shop's words — and never the mechanics that used to lead the screen.
    expect(screen.getByText(/9 record\(s\) have nowhere to go until the add-on that owns them is installed here/)).not.toBeNull();
    expect(screen.queryByText(/Expand a table below/)).toBeNull();
    expect(screen.queryByText(/re-numbered/)).toBeNull();
  });
});
