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

    expect(screen.getByText(/2 record\(s\) with no label of their own, in 1 other kind\(s\)/)).not.toBeNull();
    expect(screen.getByText(/2 in total\./)).not.toBeNull();
    // The default-visible caption must never say "table" — that is the exact wording the owner
    // rejected three times before; the physical name only ever appears once this fold is opened.
    expect(screen.queryByText(/\btables?\b/i)).toBeNull();
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
    expect(screen.getByText((_, node) => node?.className === 'fc-import-plan__arrival-item' && /40\s*people/.test(node.textContent ?? ''))).not.toBeNull();
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

  it('says nothing about integrations when the archive carries no secret at all', () => {
    // No prior test covered this: `manifest.secretsSealed` defaults to `false` whether or not the
    // export even offered a passphrase, so gating on it alone would print "their passwords were
    // locked..." for an archive with zero integrations — a claim about a setting that was never
    // stored. The planner's own `carry a secret` warning is the only thing that actually knows.
    render(
      <ImportPlanSummary
        plan={{ metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 }, warnings: [] }}
        arriving={[]}
        skipped={[]}
        remapped={[]}
      />,
    );

    expect(screen.queryByText(/Your settings/)).toBeNull();
    expect(screen.queryByText(/integrations/i)).toBeNull();
  });

  it('states the sealed-secrets sentence only when the planner reports a secret-bearing setting', () => {
    render(
      <ImportPlanSummary
        plan={{
          metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 },
          warnings: ['3 setting row(s) carry a secret. This archive was sealed for transit, so they are taken into this deployment\'s own key during the import.'],
          manifest: { secretsSealed: true },
        }}
        arriving={[]}
        skipped={[]}
        remapped={[]}
      />,
    );

    expect(screen.getByText(/Your integrations arrive configured and working — nothing to enter again\./)).not.toBeNull();
  });

  it('states the unsealed-secrets sentence when the planner reports a secret the archive could not seal', () => {
    render(
      <ImportPlanSummary
        plan={{
          metaRowsExcluded: 0, pluginSettingsRowsExcluded: 0, users: emptyUsers, files: { count: 0, colliding: 0 },
          warnings: ['3 setting row(s) carry a secret encrypted by the deployment that exported them.'],
          manifest: { secretsSealed: false },
        }}
        arriving={[]}
        skipped={[]}
        remapped={[]}
      />,
    );

    expect(screen.getByText(/Open Settings.*Integrations afterwards to enter them again\./)).not.toBeNull();
  });
});
