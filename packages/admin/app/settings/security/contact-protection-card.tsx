import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Whether this site's storefront keeps email addresses and phone numbers out of its HTML. */
export class ContactProtectionCard extends PureReactor {
  declare props: Pick<ContactProtectionCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.contactDetails')}>
        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.CONTACT_DETAIL_PROTECTION}
          icon={FrameworkIcons.Mail}
          title={AdminI18n.t('settings.security.hideContactDetails')}
          description={AdminI18n.t('settings.security.hideContactDetailsDescription')}
        />
      </Card>
    );
  }
}
