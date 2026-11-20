import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { ListShellHead } from '@/components/ui/view/list-shell-head.client';

/**
 * A list as ONE card: its name and its actions in the head, what narrows it and what searches it in a
 * band under the head, the table from edge to edge, and a foot. Each band is divided by the card's own
 * hairline, so a list reads the same wherever it stands — a collection, the activity log, a task's runs.
 *
 * `children` is the list itself (a `DataTable`, or the bands a caller builds from its own parts); the
 * shell is the frame, so the table inside it draws none of its own.
 */
export class ListShell extends PureReactor {
  @prop declare children?: ReactNode;
  /** The list's name. Without one the caller supplies its own head as the first child. */
  @prop declare title?: ReactNode;
  /** How many the list holds, beside the name: `0` is a figure and is shown, `null` is not. */
  @prop declare count?: number | null;
  /** One line under the name, for a list that has to explain itself. */
  @prop declare subtitle?: ReactNode;
  /** The list's actions, at the end of the head. */
  @prop declare actions?: ReactNode;
  /** What narrows the list — usually `Tabs` or a Filters button — at the start of the band. */
  @prop declare lead?: ReactNode;
  /** What works on the list — the search, the order — at the end of the band. */
  @prop declare tools?: ReactNode;
  @prop declare foot?: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    const hasHead = this.title !== undefined && this.title !== null && this.title !== '';
    return (
      <div className={`${AdminClass.SURFACE} ${AdminClass.of('list-shell')} ${this.className ?? ''}`}>
        {hasHead ? <ListShellHead title={this.title} count={this.count} subtitle={this.subtitle} actions={this.actions} /> : null}
        {this.lead || this.tools ? (
          <div className={AdminClass.of('list-toolbar-band')}>
            <div className={AdminClass.of('list-toolbar')}>
              <div className={`${AdminClass.of('list-toolbar')}__lead`}>{this.lead}</div>
              <div className={`${AdminClass.of('list-toolbar')}__tools`}>{this.tools}</div>
            </div>
          </div>
        ) : null}
        {this.children}
        {this.foot ? <div className={AdminClass.of('list-foot')}>{this.foot}</div> : null}
      </div>
    );
  }
}
