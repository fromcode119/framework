import type { ReactNode } from 'react';
import type { IImportPlanTable } from '@/app/sites/import/interfaces/import-plan-table.interface';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanSummary } from '@/app/sites/import/import-plan-summary.client';
import { ImportPlanDetail } from '@/app/sites/import/import-plan-detail.client';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';

/**
 * The import plan, as something an operator can actually read before deciding. Presentational.
 *
 * This went through three shapes. First one flat table over all 133 entries with a `Why` column of
 * server-written prose. Then four grouped tables, which fixed the repetition but still LED with
 * physical table names, `LOWEST ID` and `HANDED OUT HERE` — a database engineer's proof of
 * correctness, put in front of an operator who only wants to know what they get and what they lose.
 * Then the counted tiles that answer that first, with the engineer's view folded below them.
 *
 * This shape keeps the tiles and changes what is under them. The four mode groups are gone as a
 * top-level idea: three of the four were about ids, which an operator cannot see and cannot act on,
 * because every reference moves with a re-numbering. `ImportPlanRecords` groups by the answer
 * instead — does not come across, comes across with something missing, comes across in full — and
 * each row's ids, columns and links sit behind its own Technical disclosure.
 *
 * Nothing is hidden that has an effect: every figure the planner produced is still on this screen,
 * and blockers, which DO stop the import, are never folded.
 */
export class ImportPlanView extends PureReactor {
  @prop declare plan: Record<string, any>;

  private get records(): ImportPlanRecord[] {
    return ImportPlanRecord.from(
      (this.plan.tables ?? []) as IImportPlanTable[],
      this.plan.metaRowsExcluded ?? 0,
      this.plan.pluginSettingsRowsExcluded ?? 0,
    );
  }

  render(): ReactNode {
    const plan = this.plan;
    const manifest = plan.manifest ?? {};
    const records = this.records;
    // What actually ARRIVES — every kind with rows and somewhere to put them.
    const arriving = records.filter((record) => !record.isEmpty && record.outcome !== ImportPlanOutcome.NONE);
    const blockers: string[] = plan.blockers ?? [];

    return (
      <div className="fc-import-plan">
        <p className="fc-sites__text">
          Archive of <strong>{manifest.tenant?.slug}</strong> ({manifest.source === 'single-tenant' ? 'a single-tenant deployment' : 'a site'}), exported {manifest.exportedAt} from framework {manifest.frameworkVersion || '?'}.
        </p>

        {blockers.length ? (
          <div className="fc-import-plan__blockers">
            <b>Resolve {blockers.length === 1 ? 'this' : 'these'} before importing</b>
            <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          </div>
        ) : null}

        <ImportPlanSummary plan={plan} records={records} arriving={arriving} />

        <ImportPlanDetail
          records={records}
          plugins={plan.plugins ?? []}
          theme={plan.theme ?? null}
          warnings={plan.warnings ?? []}
          exportWarnings={plan.exportWarnings ?? []}
        />
      </div>
    );
  }
}
