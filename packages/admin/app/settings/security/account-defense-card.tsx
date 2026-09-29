import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingNumberRow } from '@/app/settings/security/setting-number-row';
import { SettingSwitchRow } from '@/app/settings/security/setting-switch-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class AccountDefenseCard extends PureReactor {
  declare props: Pick<AccountDefenseCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.accountDefense')}>
        <SettingNumberRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_SESSION_DURATION}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.security.loginSessionDurationMinutes')}
          description={AdminI18n.t('settings.security.howLongAUserStays')}
          min={15}
          max={43200}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.TWO_FACTOR_ENABLED}
          icon={FrameworkIcons.ShieldCheck}
          title={AdminI18n.t('settings.security.twoFactorSecurity')}
          description={AdminI18n.t('settings.security.addAnExtraLayerOf')}
        />

        <SettingSwitchRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS}
          icon={FrameworkIcons.Mail}
          title={AdminI18n.t('settings.security.securityNotificationEmails')}
          description={AdminI18n.t('settings.security.emailTheAccountOwnerWhen')}
        />
      </Card>
    );
  }
}
