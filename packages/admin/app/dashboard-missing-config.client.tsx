import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminPathUtils } from '@/lib/admin-path';
import { DashboardSectionHeading } from '@/app/dashboard-section-heading';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The things that are not configured and will silently not work — email being the sharp one, since
 * a platform that cannot send mail fails at the first password reset.
 *
 * Configured items stay on the list rather than disappearing: "Timezone · Europe/Madrid" answers the
 * same question, and a list that only shows problems cannot be used to check.
 *
 * One row per item, one LINE per row, exactly like the sites list above it. Two columns put a
 * two-line row beside a one-line row so nothing lined up across the gap, and stacking the state
 * under the title made some rows look like headings and others like values. Same shape every row,
 * and the eye can run down the column.
 */
export class DashboardMissingConfig extends AdminComponent {
  @prop declare items: Array<Record<string, any>>;

  @bound
  private go(path: string): void {
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
  }

  private get outstanding(): number {
    return this.items.filter((item) => !item.done).length;
  }

  render(): ReactNode {
    if (this.items.length === 0) return null;

    return (
      <ListShell title={AdminI18n.t('dashboard.configuration')}
        actions={<StateBadge tone={this.outstanding > 0 ? 'warning' : 'success'}>{this.outstanding > 0 ? AdminI18n.t('dashboard.toDo', { count: this.outstanding }) : AdminI18n.t('dashboard.allSet')}</StateBadge>}>
        <div>
          {this.items.map((item) => (
            <ListRow
              key={String(item.key)}
              title={<button type="button" className="fc-ext-row__link" onClick={() => this.go(String(item.actionPath))}>{String(item.title)}</button>}
              meta={String(item.detail)}
              actions={<>
                {item.done ? null : <StateBadge tone="warning">{AdminI18n.t('dashboard.toDo', { count: 1 })}</StateBadge>}
                {item.actionLabel ? <Button variant={ButtonVariant.GHOST} onClick={() => this.go(String(item.actionPath))}>{String(item.actionLabel)}</Button> : null}
              </>}
            />
          ))}
        </div>
      </ListShell>
    );
  }
}
