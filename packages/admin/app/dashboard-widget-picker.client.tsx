import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/** Customize mode's shelf: every widget offered that is not on this dashboard, each one click to add. */
export class DashboardWidgetPicker extends PureReactor {
  @prop declare available: IDashboardWidgetDefinition[];
  @prop declare onAdd: (definition: IDashboardWidgetDefinition) => void;

  render(): ReactNode {
    return (
      <ListShell title={AdminI18n.t('dashboard.widgets.addTitle')} count={this.available.length}>
        {this.available.length === 0 ? <EmptyState inline title={AdminI18n.t('dashboard.widgets.allAdded')} /> : (
          <div>
            {this.available.map((definition) => (
              <ListRow
                key={definition.key}
                title={<span>{definition.label}</span>}
                badges={definition.source ? <Badge>{definition.source}</Badge> : undefined}
                description={definition.description || undefined}
                actions={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={15} />} onClick={() => this.onAdd(definition)}>{AdminI18n.t('settings.general.add')}</Button>}
              />
            ))}
          </div>
        )}
      </ListShell>
    );
  }
}
