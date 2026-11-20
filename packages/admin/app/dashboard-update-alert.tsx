import { Alert } from '@/components/ui/view/alert.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';

import { prop, PureReactor } from '@fromcode119/react-class-components';
import { AppEnv } from '@/lib/env';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * A new platform version, on one line above the dashboard: an accent tile, what is new, and the two
 * things to do about it. It used to be a 90px panel with a spinning loader — a spinner says "working",
 * and nothing was. The look lives in admin.css (`.fc-update-alert`).
 */
export class DashboardUpdateAlert extends PureReactor {
  @prop declare updateAvailable: any;
  @prop declare onDismiss: () => void;
  @prop declare onViewDetails: () => void;

  render(): ReactNode {
    return (
      <Alert tone="warning" title={AdminI18n.t('dashboard.update.title')} action={(
        <>
          <Button variant={ButtonVariant.GHOST} size={FieldSize.SM} onClick={this.onDismiss}>{AdminI18n.t('dashboard.update.dismiss')}</Button>
          <Button variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={this.onViewDetails}>{AdminI18n.t('dashboard.update.details')}</Button>
        </>
      )}>
        <AdminRichText k="dashboard.update.newVersion" vars={{ product: AppEnv.PRODUCT_NAME, version: this.updateAvailable.latest }} />
      </Alert>
    );
  }
}
