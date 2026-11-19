import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Card } from '@/components/ui/view/card.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { JobRunsPanel } from '@/app/jobs/job-runs-panel.client';

/**
 * One scheduled task: its recent runs and the errors they ended with.
 *
 * A page of its own, reached from the task's row in the list. The runs used to unfold UNDER the row,
 * in place — a list that opens inside itself hides what is below it and has no address to return to.
 */
export class JobTaskPage extends AdminComponent {
  @prop declare params: Promise<{ task: string }>;

  @state private task = '';

  async componentDidMount(): Promise<void> {
    const params = await this.params;
    this.task = decodeURIComponent(params.task);
  }

  /** The list this task belongs to: this page's own address, one step up. */
  private get listHref(): string {
    return String(this.pathname || '').replace(/\/[^/]+\/?$/, '') || '/';
  }

  render(): ReactNode {
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          backHref={this.listHref}
          icon={<FrameworkIcons.Clock size={18} strokeWidth={2.5} />}
          title={this.task || AdminI18n.t('jobs.title')}
          subtitle={AdminI18n.t('jobs.title')}
        />
        <div className="w-full py-6">
          {this.task ? <Card noPadding><JobRunsPanel taskName={this.task} /></Card> : null}
        </div>
      </div>
    );
  }
}
