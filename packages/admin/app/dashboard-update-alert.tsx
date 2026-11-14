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
      <div className="fc-update-alert" role="status">
        <span className="fc-update-alert__icon" aria-hidden>
          <FrameworkIcons.Download size={16} />
        </span>
        <p className="fc-update-alert__text">
          <strong className="fc-update-alert__title">{AdminI18n.t('dashboard.update.title')}</strong>
          <span className="fc-update-alert__detail">
            <AdminRichText k="dashboard.update.newVersion" vars={{ product: AppEnv.PRODUCT_NAME, version: this.updateAvailable.latest }} classes={{ strong: 'fc-update-alert__version' }} />
          </span>
        </p>
        <div className="fc-update-alert__actions">
          <Button variant={ButtonVariant.GHOST} size={FieldSize.SM} onClick={this.onDismiss}>
            {AdminI18n.t('dashboard.update.dismiss')}
          </Button>
          <Button variant={ButtonVariant.PRIMARY} size={FieldSize.SM} className="fc-update-alert__primary" onClick={this.onViewDetails}>
            {AdminI18n.t('dashboard.update.details')}
          </Button>
        </div>
      </div>
    );
  }
}
