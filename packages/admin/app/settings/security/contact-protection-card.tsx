import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';
import type { SettingsPageScope } from '@/lib/settings/settings-page-scope';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Whether this site's storefront keeps email addresses and phone numbers out of its HTML. */
export class ContactProtectionCard extends PureReactor {
  declare props: Pick<ContactProtectionCard, 'settings' | 'setSettings' | 'theme' | 'scope'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;
  @prop declare scope?: SettingsPageScope;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.contactDetails')}>
        <SettingSwitchRow
          theme={this.theme}
          scope={this.scope}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.CONTACT_DETAIL_PROTECTION}
          title={AdminI18n.t('settings.security.hideContactDetails')}
          description={AdminI18n.t('settings.security.hideContactDetailsDescription')}
        />
      </Card>
    );
  }
}
