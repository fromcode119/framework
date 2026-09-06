import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';

/** The import plan, as a table the operator can read before deciding. Presentational. */
export class ImportPlanView extends PureReactor {
  @prop declare plan: Record<string, any>;

  private static modeBadge(mode: string): ReactNode {
    if (mode === 'preserve') return <Badge variant={BadgeVariant.SUCCESS}>ids kept</Badge>;
    if (mode === 'remap') return <Badge variant={BadgeVariant.WARNING}>re-numbered</Badge>;
    return <Badge variant={BadgeVariant.GRAY}>skipped</Badge>;
  }

  render(): ReactNode {
    const plan = this.plan;
    const tables: Array<Record<string, any>> = plan.tables ?? [];
    const manifest = plan.manifest ?? {};
    return (
      <div className="fc-import-plan">
        <p className="fc-sites__text">
          Archive of <strong>{manifest.tenant?.slug}</strong> ({manifest.source === 'single-tenant' ? 'a single-tenant deployment' : 'a site'}), exported {manifest.exportedAt} from framework {manifest.frameworkVersion || '?'}.
          {' '}{plan.users?.total ?? 0} people: {plan.users?.existing ?? 0} already have accounts here, {plan.users?.toCreate ?? 0} will be created.
          {' '}{plan.files?.count ?? 0} files{plan.files?.colliding ? ` (${plan.files.colliding} renamed)` : ''}.
        </p>

        {(plan.blockers ?? []).length ? (
          <ul className="fc-sites__blockers">{plan.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>
        ) : null}

        <div className="fc-import-plan__inventory">
          <div>
            <span className="fc-site-form__label">Plugins</span>
            {(plan.plugins ?? []).length === 0 ? <span className="fc-sites__none">none</span> : null}
            {(plan.plugins ?? []).map((p: any) => (
              <span key={p.slug} className="fc-import-plan__item">
                {p.slug} {p.archiveVersion}{' '}
                {p.installedVersion ? <Badge variant={BadgeVariant.SUCCESS}>installed {p.installedVersion}</Badge> : <Badge variant={BadgeVariant.DANGER}>not installed</Badge>}
              </span>
            ))}
          </div>
          <div>
            <span className="fc-site-form__label">Theme</span>
            {plan.theme ? (
              <span className="fc-import-plan__item">
                {plan.theme.slug} {plan.theme.archiveVersion}{' '}
                {plan.theme.installedVersion ? <Badge variant={BadgeVariant.SUCCESS}>installed {plan.theme.installedVersion}</Badge> : <Badge variant={BadgeVariant.DANGER}>not installed</Badge>}
              </span>
            ) : <span className="fc-sites__none">none</span>}
          </div>
        </div>

        <div className="fc-import-plan__tables">
          <table className="fc-import-plan__table">
            <thead><tr><th>Table</th><th>Rows</th><th>Ids</th><th>Why</th></tr></thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.name}>
                  <td><code>{table.name}</code></td>
                  <td>{table.rows}</td>
                  <td>{ImportPlanView.modeBadge(table.mode)}</td>
                  <td>
                    {table.reason}
                    {(table.opaqueJsonColumns ?? []).length ? <> JSON columns NOT re-pointed: <code>{table.opaqueJsonColumns.join(', ')}</code>.</> : null}
                    {(table.droppedColumns ?? []).length ? <> Dropped (no such column here): <code>{table.droppedColumns.join(', ')}</code>.</> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(plan.warnings ?? []).length ? (
          <ul className="fc-sites__warnings">{plan.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul>
        ) : null}
      </div>
    );
  }
}
