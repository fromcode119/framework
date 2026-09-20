import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ImportPlanRecord } from '@/app/sites/import/import-plan-record';
import { ImportPlanOutcome } from '@/app/sites/import/enums/import-plan-outcome.enum';

/**
 * What the archive was running, and whether this platform has it.
 *
 * Two columns of `slug version [badge]` spans treated "installed" and "not installed" as equally
 * interesting, when only one of them costs the operator anything. The missing ones now lead, under a
 * heading that says what they cost — the exact rows waiting on them, counted from the same records
 * the panel beside this one lists, never a second tally that could drift from it.
 *
 * It names no plugin: every slug and version here is a value the plan sent.
 */
export class ImportPlanInventory extends PureReactor {
  @prop declare plugins: Array<Record<string, any>>;
  @prop declare theme: Record<string, any> | null;
  /** Read only to count the rows each missing plugin is holding up. */
  @prop declare records: ImportPlanRecord[];

  private get missing(): Array<Record<string, any>> {
    return this.plugins.filter((plugin) => !plugin.installedVersion);
  }

  private get installed(): Array<Record<string, any>> {
    return this.plugins.filter((plugin) => Boolean(plugin.installedVersion));
  }

  /** Rows with nowhere to go, per owning plugin — the same figure that plugin's records show on their own lines. */
  private rowsWaitingOn(slug: string): number {
    return this.records
      .filter((record) => record.outcome === ImportPlanOutcome.NONE && record.table.pluginSlug === slug)
      .reduce((sum, record) => sum + record.table.rows, 0);
  }

  private get totalWaiting(): number {
    return this.records
      .filter((record) => record.outcome === ImportPlanOutcome.NONE)
      .reduce((sum, record) => sum + record.table.rows, 0);
  }

  /** Same version, or a different one — stated rather than left for the reader to diff two numbers. */
  private static versionNote(archive: string, installed: string): string {
    if (archive === installed) return 'same version';
    return `archive ${archive}`;
  }

  private static row(key: string, name: ReactNode, meta: string, badge: ReactNode): ReactNode {
    return (
      <div className="fc-import-inv__row" key={key}>
        <span className="fc-import-inv__name">{name}</span>
        <span className="fc-import-inv__meta">{meta}</span>
        {badge}
      </div>
    );
  }

  render(): ReactNode {
    const missing = this.missing;
    const installed = this.installed;
    const theme = this.theme;
    const waiting = this.totalWaiting;

    return (
      <div className="fc-import-inv">
        <p className="fc-import-detail__rule">
          What the archive was running, and whether this platform has it. A plugin that is missing does not stop the
          import — its records simply have nowhere to go until you install it.
        </p>

        {missing.length ? (
          <>
            <div className="fc-import-inv__group fc-import-inv__group--bad">
              Not installed here{waiting > 0 ? ` — ${waiting.toLocaleString()} record(s) wait for these` : ''}
            </div>
            {missing.map((plugin) => {
              const rows = this.rowsWaitingOn(String(plugin.slug));
              return ImportPlanInventory.row(
                String(plugin.slug),
                <><b>{plugin.slug}</b> <span className="fc-import-inv__ver">{plugin.archiveVersion}</span></>,
                rows > 0 ? `${rows.toLocaleString()} record(s)` : 'no records of its own',
                <span className="fc-import-inv__badge fc-import-inv__badge--no">not installed</span>,
              );
            })}
          </>
        ) : null}

        <div className="fc-import-inv__group">
          {installed.length.toLocaleString()} installed here{theme ? ', and the theme' : ''}
        </div>
        {installed.length === 0 && !theme ? <p className="fc-import-detail__rule">The archive names no plugin and no theme.</p> : null}
        {installed.map((plugin) => ImportPlanInventory.row(
          String(plugin.slug),
          <><b>{plugin.slug}</b> <span className="fc-import-inv__ver">{plugin.installedVersion}</span></>,
          ImportPlanInventory.versionNote(String(plugin.archiveVersion), String(plugin.installedVersion)),
          <span className="fc-import-inv__badge fc-import-inv__badge--ok">installed</span>,
        ))}
        {theme ? ImportPlanInventory.row(
          `theme:${theme.slug}`,
          <><b>Theme — {theme.slug}</b> <span className="fc-import-inv__ver">{theme.archiveVersion}</span></>,
          theme.installedVersion ? 'activated on import' : 'must be installed before the theme can be activated',
          theme.installedVersion
            ? <span className="fc-import-inv__badge fc-import-inv__badge--ok">installed {theme.installedVersion}</span>
            : <span className="fc-import-inv__badge fc-import-inv__badge--no">not installed</span>,
        ) : null}
      </div>
    );
  }
}
