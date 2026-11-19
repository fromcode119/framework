import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { DetailBox } from '@/components/view/detail-box.client';
import type { ITheme } from '@/app/themes/[slug]/interfaces/theme.interface';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The integrations the theme declares it needs, each linking to where it is configured. Absent when it declares none. */
export class ThemeOverviewIntegrations extends PureReactor {
  @prop declare integrations: NonNullable<ITheme['integrationRequirements']>;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    if (!this.integrations.length) return null;
    return (
      <ListShell title={AdminI18n.t('themes.integrationRequirements')} count={this.integrations.length}>
        <div>
          {this.integrations.map((integration) => (
            <ListRow key={integration.type}
              title={integration.label || integration.type}
              badges={<Badge variant={integration.required === false ? BadgeVariant.DEFAULT : BadgeVariant.WARNING}>{integration.required === false ? AdminI18n.t('themes.optional') : AdminI18n.t('themes.required')}</Badge>}
              description={integration.description || AdminI18n.t('themes.configureIntegrationForThisTheme', { type: integration.type })}
              actions={<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE(integration.type)}>{AdminI18n.t('themes.openIntegrationSettings')}</Button>} />
          ))}
        </div>
      </ListShell>
    );
  }
}
